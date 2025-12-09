"use client"

import { motion } from "framer-motion"
import BucketCard from "./BucketCard"
import type { BucketType } from "@/types"

interface BucketGridProps {
  onBucketSelect: (bucketType: BucketType) => void
}

const BUCKETS: BucketType[] = ['bills', 'savings', 'growth', 'spendable']

export default function BucketGrid({ onBucketSelect }: BucketGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {BUCKETS.map((bucketType, index) => (
        <motion.div
          key={bucketType}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <BucketCard 
            bucketType={bucketType} 
            onClick={() => onBucketSelect(bucketType)} 
          />
        </motion.div>
      ))}
    </motion.div>
  )
}
