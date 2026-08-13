import re

# Fix 1: broker-accounts.tsx - add idle key
with open('components/broker-accounts.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'const progressLabel = { connecting:',
    'const progressLabel = { idle: "", connecting:'
)

with open('components/broker-accounts.tsx', 'w') as f:
    f.write(content)
print("✅ Fixed broker-accounts.tsx")

# Fix 2: chat/route.ts - update API method
with open('app/api/openai/chat/route.ts', 'r') as f:
    content = f.read()

content = content.replace('toAIStreamResponse', 'toTextStreamResponse')

with open('app/api/openai/chat/route.ts', 'w') as f:
    f.write(content)
print("✅ Fixed chat/route.ts")

# Fix 3: next.config.mjs - remove ignoreBuildErrors
with open('next.config.mjs', 'r') as f:
    content = f.read()

# Remove the typescript block
content = re.sub(r'\s*typescript:\s*\{\s*ignoreBuildErrors:\s*true,\s*\},', '', content)

with open('next.config.mjs', 'w') as f:
    f.write(content)
print("✅ Fixed next.config.mjs")

# Fix 4: trade-journal.tsx - add validation + Lots label
with open('components/trade-journal.tsx', 'r') as f:
    content = f.read()

# Change label
content = content.replace('Position Size (Units/Lots)', 'Position Size (Lots)')
content = content.replace('Enter position size', 'Enter position size in lots')

# Add validateTradeInputs function before saveTrade
validation_func = '''  // Validate trade inputs before saving
  const validateTradeInputs = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const entry = Number.parseFloat(entryPrice)
    const sl = stopLossPrice ? Number.parseFloat(stopLossPrice) : 0
    const tp = takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0
    const size = Number.parseFloat(positionSize)

    if (isNaN(entry) || entry <= 0) errors.push("Entry price must be a positive number")
    if (stopLossPrice && (isNaN(sl) || sl <= 0)) errors.push("Stop loss must be a positive number")
    if (takeProfitPrice && (isNaN(tp) || tp <= 0)) errors.push("Take profit must be a positive number")
    if (isNaN(size) || size <= 0) errors.push("Position size (lots) must be a positive number")

    if (action === "buy") {
      if (stopLossPrice && sl >= entry) errors.push("For a BUY trade, stop loss must be BELOW the entry price")
      if (takeProfitPrice && tp <= entry) errors.push("For a BUY trade, take profit must be ABOVE the entry price")
    }
    if (action === "sell") {
      if (stopLossPrice && sl <= entry) errors.push("For a SELL trade, stop loss must be ABOVE the entry price")
      if (takeProfitPrice && tp >= entry) errors.push("For a SELL trade, take profit must be BELOW the entry price")
    }

    if (stopLossPrice && takeProfitPrice && action && !isNaN(entry) && !isNaN(sl) && !isNaN(tp) && entry > 0) {
      const risk = Math.abs(entry - sl)
      const reward = Math.abs(tp - entry)
      if (reward > 0 && risk > 0 && reward < risk) {
        errors.push("Warning: Reward is less than risk. Consider a better risk:reward ratio")
      }
    }

    return { valid: errors.length === 0, errors }
  }

'''

# Insert before "// Save the trade"
content = content.replace('  // Save the trade\n', validation_func + '  // Save the trade\n')

# Update saveTrade beginning
old_save_start = '''  const saveTrade = () => {
    if (!currencyPair) {
      toast({
        title: "Error",
        description: "Please select a currency pair",
        variant: "destructive",
      })
      return
    }

    if (!action) {
      toast({
        title: "Error",
        description: "Please select an action (buy/sell)",
        variant: "destructive",
      })
      return
    }

    if (!entryPrice) {
      toast({
        title: "Error",
        description: "Please enter an entry price",
        variant: "destructive",
      })
      return
    }

    if (!positionSize) {
      toast({
        title: "Error",
        description: "Please enter a position size",
        variant: "destructive",
      })
      return
    }

    if (!conditions.some((cond) => cond.checked)) {
      toast({
        title: "Error",
        description: "Please select at least one condition",
        variant: "destructive",
      })
      return
    }'''

new_save_start = '''  const saveTrade = () => {
    const { valid, errors } = validateTradeInputs()
    if (!valid) {
      toast({ title: "Validation Error", description: errors.join(". "), variant: "destructive" })
      return
    }

    if (!currencyPair) {
      toast({ title: "Error", description: "Please select a currency pair", variant: "destructive" })
      return
    }

    if (!conditions.some((cond) => cond.checked)) {
      toast({ title: "Error", description: "Please select at least one condition", variant: "destructive" })
      return
    }'''

content = content.replace(old_save_start, new_save_start)

with open('components/trade-journal.tsx', 'w') as f:
    f.write(content)
print("✅ Fixed trade-journal.tsx")

print("\n🎉 All fixes applied! Now commit and push.")
