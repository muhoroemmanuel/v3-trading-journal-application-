"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface TradeImage {
  id: string
  file: File
  preview: string
  caption: string
}

export interface UseImageUploadsReturn {
  images: TradeImage[]
  addImages: (files: File[]) => { added: number; rejected: number; errors: string[] }
  removeImage: (id: string) => void
  clearAllImages: () => void
  updateCaption: (id: string, caption: string) => void
  moveImage: (fromIndex: number, toIndex: number) => void
}

const VALID_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/tiff",
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function useImageUploads(): UseImageUploadsReturn {
  const [images, setImages] = useState<TradeImage[]>([])
  const createdUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      createdUrlsRef.current.clear()
    }
  }, [])

  const addImages = useCallback((files: File[]) => {
    const errors: string[] = []
    let added = 0
    let rejected = 0

    const validFiles = files.filter((file) => {
      if (!VALID_TYPES.includes(file.type)) {
        rejected++
        errors.push(`${file.name}: unsupported format`)
        return false
      }
      if (file.size > MAX_SIZE) {
        rejected++
        errors.push(`${file.name}: exceeds 10MB`)
        return false
      }
      return true
    })

    const newImages = validFiles.map((file) => {
      const preview = URL.createObjectURL(file)
      createdUrlsRef.current.add(preview)
      added++
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        caption: "",
      }
    })

    setImages((prev) => [...prev, ...newImages])
    return { added, rejected, errors }
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview)
        createdUrlsRef.current.delete(imageToRemove.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }, [])

  const clearAllImages = useCallback(() => {
    setImages((prev) => {
      prev.forEach((image) => {
        URL.revokeObjectURL(image.preview)
        createdUrlsRef.current.delete(image.preview)
      })
      return []
    })
  }, [])

  const updateCaption = useCallback((id: string, caption: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption: caption.trim() } : img))
    )
  }, [])

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0) return
    setImages((prev) => {
      if (toIndex >= prev.length) return prev
      const newImages = [...prev]
      const [movedImage] = newImages.splice(fromIndex, 1)
      newImages.splice(toIndex, 0, movedImage)
      return newImages
    })
  }, [])

  return {
    images,
    addImages,
    removeImage,
    clearAllImages,
    updateCaption,
    moveImage,
  }
}
