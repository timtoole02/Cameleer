export const NEW_CHAT_SENTINEL = '__new__'

export function resolveSelectedConversation(conversations, selectedConversationId) {
  const items = conversations || []
  if (selectedConversationId === NEW_CHAT_SENTINEL) return null
  if (!selectedConversationId) return items[0] || null
  return items.find((conversation) => conversation.id === selectedConversationId) || items[0] || null
}

export function shouldCreateConversationForSend(selectedConversation, selectedConversationId) {
  return selectedConversationId === NEW_CHAT_SENTINEL || !selectedConversation
}
