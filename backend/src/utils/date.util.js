module.exports = {
  // Format date for display
  formatMessageDate(date) {
    const now = new Date();
    const msgDate = new Date(date);
    const diff = now - msgDate;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return msgDate.toLocaleDateString();
  },

  // Check if message is today
  isToday(date) {
    const today = new Date();
    const msgDate = new Date(date);

    return today.toDateString() === msgDate.toDateString();
  },

  // Check if message is this week
  isThisWeek(date) {
    const now = new Date();
    const msgDate = new Date(date);
    const diff = now - msgDate;

    return diff < 7 * 24 * 60 * 60 * 1000;
  },
};
