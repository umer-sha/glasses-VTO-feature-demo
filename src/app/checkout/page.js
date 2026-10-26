"use client";

import Link from "next/link";

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
        <h1 className="text-2xl font-light tracking-wide">Secure Checkout Billing</h1>
        <p className="text-xs text-neutral-400">
          AR Virtual Try-On order verified. Ready for final payment processing.
        </p>
        <button
          onClick={() => alert("Order successfully completed!")}
          className="w-full py-3 bg-white text-black font-medium text-xs rounded-xl hover:bg-neutral-200 transition"
        >
          Confirm & Pay $149.00
        </button>
        <div className="pt-2">
          <Link href="/" className="text-xs text-neutral-400 hover:text-white">
            ← Return to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}