export interface Trade {
  id: string
  user_id: string
  currency_pair: string
  action: "buy" | "sell"
  entry_price: number
  stop_loss_price: number | null
  take_profit_price: number | null
  exit_price: number | null
  position_size: number
  status: "open" | "closed"
  profit_loss: number | null
  notes: string | null
  conditions: Array<{
    id: string
    description: string
    confidence: number
    checked: boolean
  }>
  images: Array<{
    id: string
    file_name: string
    file_type: string
    file_size: number
    caption: string
    preview: string
  }>
  created_at: string
  updated_at: string
}

export interface Preset {
  id: string
  user_id: string
  name: string
  conditions: Trade["conditions"]
  created_at: string
}
