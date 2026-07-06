export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
): Promise<readonly Output[]> {
  if (items.length === 0) {
    return []
  }

  const results: Array<Output | undefined> = new Array(items.length)
  const workerCount = Math.min(concurrency, items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]

      if (item !== undefined) {
        results[index] = await mapper(item, index)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))

  return results.map((result, index) => {
    if (result === undefined) {
      throw new Error(`Concurrent mapper did not produce a result for index ${index}.`)
    }

    return result
  })
}
