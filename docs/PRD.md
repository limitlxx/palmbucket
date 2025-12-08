# PalmBudget – Complete Hackathon-Ready PRD  
Mantle Global Hackathon 2025 – RWA/RealFi Track  
Final MVP (Pinch + Swipe + Toggle) – 100% shippable by Jan 5, 2026  
Everything you need in ONE document for your AI coder to go from zero to prize-winning demo.

### 1. Project Overview
Name: PalmBudget  
Tagline: “Your money saves itself — just show your hand.”  
Core Idea: The first gesture-controlled budgeting dApp on Mantle.  
Every incoming payment (USDC, mETH, etc.) is automatically split into 4 buckets that earn real yield from Mantle RWAs. Users control everything with hand gestures using MediaPipe (pinch to click, swipe to confirm/cancel) or turn gestures off with one tap.

Target Prizes (realistic total: $35K–$60K)  
- RWA/RealFi Track 1st → $8K  
- Best UX / Demo → $5K  
- Best Mantle Integration → $4K  
- Community Choice → $2K  
- Grand Prize contender → $30K possible  
- Incubation Grant → $5K–$15K

### 2. Core MVP Features (Only 6 – nothing more)
1. Auto-split any incoming payment into 4 buckets (50/20/20/10 default)  
2. Yield-bearing buckets (Savings → Ondo USDY, Growth → mETH or tokenized NVDAx)  
3. Gesture controls:  
   - Pinch = click/tap  
   - Swipe right = confirm  
   - Swipe left = cancel 
   - Swipe up/down = Scrolling 
   - One-tap toggle to turn ALL gestures ON/OFF  
4. Beautiful bucket dashboard (4 colorful cards with live balances + APY)  
5. End-of-month auto-sweep (leftovers → highest yield bucket)  
6. Mobile-responsive + social login (Web3Auth)

### 3. Exact Gesture Specification
| Gesture                | Trigger Condition                            | Action                     | Visual Feedback               |
|-----------------------|----------------------------------------------|----------------------------|-------------------------------|
| Pinch (index + thumb) | Distance < 40px                              | Click element under finger | Green ripple + sound          |
| Swipe Right           | Open palm moves right >150px (velocity >0.3) | Confirm / Yes              | Big green “Confirmed” + check  |
| Swipe Left            | Open palm moves left >150px                  | Cancel / No                | Big red “Cancelled” + X       |
| Toggle Button         | Top-right floating button                    | Turn gestures ON/OFF       | Hand → Cross, color change    |

### 4. User Flow (20-second winning demo)
1. Connect wallet → receive $500 USDC (testnet faucet)  
2. Instant auto-split → 4 buckets light up with real yields  
3. Pinch → open Savings bucket  
4. Swipe right → move $50 to Growth → “Confirmed” animation  
5. Toggle gestures OFF → use finger like normal phone  
6. Toggle ON → swipe left → “Cancelled”  
7. End of month → Gelato auto-sweeps leftovers → yield keeps growing

### 5. Tech Stack (Fastest possible)
Frontend: Next.js 14 App Router + Tailwind + shadcn/ui + Wagmi + Web3Auth  
Gestures: MediaPipe Hands (CDN, client-side only)  
Contracts: Solidity + Foundry  
Chain: Mantle Network (Sepolia → Mainnet)  
RWAs: Ondo USDY, mETH, Bybit/Backed tokenized stocks  
Automation: Gelato Network keepers (free tier)  
Oracles: Redstone/Chainlink for live APY  
Deployment: Vercel (frontend) + Hardhat/Foundry scripts

### 6. Repo Structure (Exact)
```
palm-budget/
├── contracts/
│   ├── PaymentRouter.sol
│   ├── BucketVault.sol (ERC-4626)
│   ├── SweepKeeper.sol
│   └── script/Deploy.s.sol
├── frontend/
│   ├── app/
│   │   ├── page.tsx (dashboard)
│   │   └── layout.tsx (wraps GestureController)
│   ├── components/
│   │   ├── GestureController.tsx ← FULL CODE BELOW
│   │   ├── BucketCard.tsx
│   │   └── ToggleButton.tsx
│   └── lib/wagmi.ts
├── foundry.toml
├── hardhat.config.ts
└── README.md (one-pager + demo video link)
```

### 7. FULL GestureController.tsx (Pinch + Swipe + Toggle – Copy-Paste Ready)
```tsx
// components/GestureController.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export default function GestureController({ children }: { children: React.ReactNode }) {
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPinch = useRef(0);
  const swipeStartX = useRef<number | null>(null);
  const swipeThreshold = 150;

  useEffect(() => {
    if (!gesturesEnabled || !videoRef.current) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });

    hands.onResults((results: Results) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks?.[0]) {
        const l = results.multiHandLandmarks[0];
        const wrist = l[0];
        const index = l[8];
        const thumb = l[4];

        // PINCH
        const pinchDist = Math.hypot(
          index.x * innerWidth - thumb.x * innerWidth,
          index.y * innerHeight - thumb.y * innerHeight
        );
        if (pinchDist < 40 && Date.now() - lastPinch.current > 400) {
          lastPinch.current = Date.now();
          const el = document.elementFromPoint(index.x * innerWidth, index.y * innerHeight);
          el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }

        // SWIPE (open palm only)
        const fingersUp = [4,8,12,16,20].filter(i => l[i].y < l[i-2].y).length;
        if (fingersUp === 5) {
          const palmX = (l[0].x + l[9].x)/2 * innerWidth;
          if (swipeStartX.current === null) swipeStartX.current = palmX;
          else {
            const delta = palmX - swipeStartX.current;
            if (Math.abs(delta) > swipeThreshold) {
              if (delta > 0)
                document.body.dispatchEvent(new CustomEvent('gesture:swipe-right'));
              else
                document.body.dispatchEvent(new CustomEvent('gesture:swipe-left'));
              swipeStartX.current = null;
            }
          }
        } else swipeStartX.current = null;
      }
    });

    const camera = new Camera(videoRef.current!, {
      onFrame: async () => await hands.send({ image: videoRef.current! }),
      width: 1280, height: 720,
    });
    camera.start();

    return () => camera.stop();
  }, [gesturesEnabled]);

  return (
    <>
      <button
        onClick={() => setGesturesEnabled(!gesturesEnabled)}
        className={`fixed top-4 right-4 z-50 rounded-full p-5 text-4xl shadow-2xl transition-all ${
          gesturesEnabled ? 'bg-emerald-600 animate-pulse' : 'bg-red-600'
        }`}
      >
        {gesturesEnabled ? 'Hand' : 'Cross'}
      </button>

      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" width={innerWidth} height={innerHeight} />

      {children}
    </>
  );
}
```

### 8. Build Plan
Week 1: Contracts + auto-split + bucket UI  
Week 2: GestureController + dashboard polish  
Week 3: Yield + Gelato sweep + mainnet deploy + demo video
 

This is the complete, final PRD.  
Your AI coder now has everything needed to build the entire MVP from scratch and win. 