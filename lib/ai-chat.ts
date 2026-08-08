export async function getChatResponse(message: string, history: { role: string; content: string }[]) {
  // In a real implementation, this would use the AI SDK to generate a response
  // For example:
  /*
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: message,
      system: "You are a helpful trading assistant that provides concise advice about trading, price alerts, and market analysis.",
      messages: history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    })
    return text
  } catch (error) {
    console.error('Error generating AI response:', error)
    throw error
  }
  */

  // For demo purposes, we'll return simulated responses
  if (message.toLowerCase().includes("price alert")) {
    return "Price alerts notify you when a currency pair reaches a specific price level. You can set alerts for when prices go above or below your target."
  } else if (message.toLowerCase().includes("currency")) {
    return "You can select from popular currency pairs or add custom pairs in the journal section. Price alerts work with any currency pair in your system."
  } else if (message.toLowerCase().includes("notification")) {
    return "Make sure notifications are enabled in your settings page. You can receive both push notifications in your browser and email notifications."
  } else if (message.toLowerCase().includes("strategy") || message.toLowerCase().includes("trade")) {
    return "When developing a trading strategy, consider factors like support/resistance levels, trend direction, and risk management. Always use stop losses to protect your capital."
  } else {
    return "I'm your trading assistant. I can help with price alerts, trading strategies, and using the journal. What specific question do you have about trading?"
  }
}
