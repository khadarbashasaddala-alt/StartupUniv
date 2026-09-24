"use client"

import { useEffect, useRef, useState } from "react"
import { motion, HTMLMotionProps, Variants } from "framer-motion"
import { cn } from "@/lib/utils"

interface TimelineContentProps extends HTMLMotionProps<"div"> {
  animationNum: number
  timelineRef: React.RefObject<HTMLElement>
  customVariants?: Variants
  as?: keyof JSX.IntrinsicElements
}

export function TimelineContent({
  animationNum,
  timelineRef,
  customVariants,
  as = "div",
  className,
  children,
  ...props
}: TimelineContentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.1,
      }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [])

  const defaultVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: animationNum * 0.1,
      },
    },
  }

  const variants = customVariants || defaultVariants

  const MotionComponent = motion[as as keyof typeof motion] as typeof motion.div

  return (
    <MotionComponent
      ref={elementRef as any}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={variants}
      className={cn(className)}
      {...(props as any)}
    >
      {children}
    </MotionComponent>
  )
}

