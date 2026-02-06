import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ENTRY_FEE_USDC, MONAD_CHAIN_ID, MONAD_RPC, USDC_DECIMALS } from "./constants";

// Monad Mainnet
const MONAD_NETWORK = `eip155:${MONAD_CHAIN_ID}` as const;
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";
const USDC_ADDRESS = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as `0x${string}`;

// Monad chain definition for viem
const monadChain = {
  id: MONAD_CHAIN_ID,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_RPC] },
  },
} as const;

// ── x402 Resource Server setup ──────────────────────────────────────────

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const evmScheme = new ExactEvmScheme();
evmScheme.registerMoneyParser(async (amount, network) => {
  if (network === MONAD_NETWORK) {
    return {
      amount: Math.floor(amount * 1e6).toString(),
      asset: USDC_ADDRESS,
      extra: { name: "USDC", version: "2" },
    };
  }
  return null;
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  MONAD_NETWORK,
  evmScheme
);

let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await resourceServer.initialize();
    initialized = true;
  }
}

// ── Server wallet ───────────────────────────────────────────────────────

export function getServerWallet(): `0x${string}` {
  const address = process.env.SERVER_WALLET_ADDRESS;
  if (!address) {
    throw new Error("[X402] SERVER_WALLET_ADDRESS environment variable is not set");
  }
  return address as `0x${string}`;
}

function getServerAccount() {
  const key = process.env.SERVER_PRIVATE_KEY;
  if (!key) {
    throw new Error("[PAYOUT] SERVER_PRIVATE_KEY environment variable is not set");
  }
  return privateKeyToAccount(key as `0x${string}`);
}

// ── x402 Payment gating ─────────────────────────────────────────────────

export async function handleX402Payment(
  request: Request
): Promise<{
  success: boolean;
  receipt?: string;
  payerAddress?: string;
  status: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
}> {
  await ensureInitialized();

  const paymentHeader = request.headers.get("x-payment");

  console.log("[X402] x-payment header present:", !!paymentHeader);

  // Parse the payment payload from the header (JSON string)
  let paymentPayload = null;
  if (paymentHeader) {
    try {
      paymentPayload = JSON.parse(paymentHeader);
    } catch {
      // Try base64 decoding
      try {
        paymentPayload = JSON.parse(atob(paymentHeader));
      } catch {
        console.error("[X402] Failed to parse x-payment header");
      }
    }
  }

  console.log("[X402] paymentPayload", paymentPayload);

  const result = await resourceServer.processPaymentRequest(
    paymentPayload,
    {
      scheme: "exact",
      network: MONAD_NETWORK,
      payTo: getServerWallet(),
      price: `$${ENTRY_FEE_USDC}`,
    },
    {
      url: request.url,
      description: "MoltGames match entry fee",
      mimeType: "application/json",
    }
  );

  console.log("[X402] processPaymentRequest result:", JSON.stringify(result, null, 2));

  if (result.success && paymentPayload) {
    // Payment signature verified - now settle it on-chain
    console.log("[X402] Payment verified, settling on-chain...");

    try {
      const settlementResult = await resourceServer.settlePayment(
        paymentPayload,
        {
          scheme: "exact",
          network: MONAD_NETWORK,
          payTo: getServerWallet(),
          asset: USDC_ADDRESS,
          amount: Math.floor(parseFloat(ENTRY_FEE_USDC) * 1e6).toString(),
          maxTimeoutSeconds: 300,
          extra: { name: "USDC", version: "2" },
        }
      );

      console.log("[X402] Settlement result:", JSON.stringify(settlementResult, null, 2));

      if (settlementResult.success) {
        return {
          success: true,
          receipt: JSON.stringify(settlementResult),
          payerAddress: settlementResult.payer,
          status: 200,
        };
      } else {
        console.error("[X402] Settlement failed:", settlementResult);
        return {
          success: false,
          status: 402,
          responseBody: { error: "Payment settlement failed" },
          responseHeaders: { "Content-Type": "application/json" },
        };
      }
    } catch (error) {
      console.error("[X402] Settlement error:", error);
      return {
        success: false,
        status: 402,
        responseBody: { error: "Payment settlement error" },
        responseHeaders: { "Content-Type": "application/json" },
      };
    }
  }

  // Payment required or verification failed
  if (result.requiresPayment) {
    return {
      success: false,
      status: 402,
      responseBody: result.requiresPayment,
      responseHeaders: { "Content-Type": "application/json" },
    };
  }

  return {
    success: false,
    status: 402,
    responseBody: { error: result.error || "Payment required" },
    responseHeaders: { "Content-Type": "application/json" },
  };
}

// ── ERC-20 transfer ABI (only the function we need) ─────────────────────

const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Payouts via viem ────────────────────────────────────────────────────

export async function sendPayout(
  toAddress: string,
  amountUsdc: string
): Promise<string | null> {
  if (!toAddress) {
    console.error("[PAYOUT] toAddress is undefined or empty");
    return null;
  }
  if (!amountUsdc) {
    console.error("[PAYOUT] amountUsdc is undefined or empty");
    return null;
  }

  try {
    const account = getServerAccount();

    const walletClient = createWalletClient({
      account,
      chain: monadChain,
      transport: http(MONAD_RPC),
    });

    const publicClient = createPublicClient({
      chain: monadChain,
      transport: http(MONAD_RPC),
    });

    const amount = parseUnits(amountUsdc, USDC_DECIMALS);

    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20TransferAbi,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, amount],
    });

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `[PAYOUT] Sent ${amountUsdc} USDC to ${toAddress} — tx: ${txHash}`
    );

    return txHash;
  } catch (error) {
    console.error("[PAYOUT] Failed to send payout:", error);
    return null;
  }
}

export async function sendRefund(
  toAddress: string
): Promise<string | null> {
  return sendPayout(toAddress, ENTRY_FEE_USDC);
}
