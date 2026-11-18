// Motivational quotes for the dashboard
export const MOTIVATIONAL_QUOTES = [
  {
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle"
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    quote: "Small daily improvements are the key to staggering long-term results.",
    author: "Unknown"
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier"
  },
  {
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    quote: "Motivation is what gets you started. Habit is what keeps you going.",
    author: "Jim Ryun"
  },
  {
    quote: "Your habits will determine your future.",
    author: "Jack Canfield"
  },
  {
    quote: "The chains of habit are too light to be felt until they are too heavy to be broken.",
    author: "Warren Buffett"
  },
  {
    quote: "First we make our habits, then our habits make us.",
    author: "John Dryden"
  },
  {
    quote: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu"
  },
  {
    quote: "Don't count the days, make the days count.",
    author: "Muhammad Ali"
  },
  {
    quote: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius"
  },
  {
    quote: "The best time to plant a tree was 20 years ago. The second best time is now.",
    author: "Chinese Proverb"
  },
  {
    quote: "What you do today can improve all your tomorrows.",
    author: "Ralph Marston"
  },
  {
    quote: "Progress, not perfection, is what we should be asking of ourselves.",
    author: "Julia Cameron"
  }
];

export function getRandomQuote(): { quote: string; author: string } {
  // Use date as seed for consistent daily quote
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[index];
}

export function getQuoteByIndex(index: number): { quote: string; author: string } {
  return MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
}
