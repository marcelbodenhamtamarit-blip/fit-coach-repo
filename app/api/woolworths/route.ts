import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const searchTerm = searchParams.get("searchTerm")

  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({ products: [] })
  }

  try {
    const res = await fetch(
      `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encodeURIComponent(searchTerm)}&pageNumber=1&pageSize=5`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      }
    )

    if (!res.ok) {
      throw new Error(`Woolworths API error: ${res.status}`)
    }

    const data = await res.json()
    const products: Array<{
      name: string
      price: number
      packageSize: string
      pricePerKg?: number
    }> = []

    if (data.Products && Array.isArray(data.Products)) {
      for (const p of data.Products.slice(0, 5)) {
        const product = p.Products ? p.Products[0] : p
        if (product) {
          const priceVal = product.Price || product.ProductPrice || 0
          const packageSize = product.PackageSize || product.PackageSizeDisplay || ""
          const nameVal = product.Name || product.DisplayName || ""

          // Calculate price per kg if possible
          let pricePerKg: number | undefined
          const sizeMatch = packageSize.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)/i)
          if (sizeMatch) {
            const sizeVal = parseFloat(sizeMatch[1])
            const unit = sizeMatch[2].toLowerCase()
            let grams = unit === "kg" ? sizeVal * 1000 : unit === "l" ? sizeVal * 1000 : unit === "ml" ? sizeVal : sizeVal
            if (grams > 0) {
              pricePerKg = (priceVal / grams) * 1000
            }
          }

          products.push({
            name: nameVal,
            price: priceVal,
            packageSize,
            pricePerKg,
          })
        }
      }
    }

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error("[Woolworths API Error]:", error)
    return NextResponse.json({ products: [], error: error.message })
  }
}
