
import { GoogleGenAI } from "@google/genai";
import { Item, LogEntry, User } from '../types';

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY && process.env.API_KEY.trim() !== "") {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} else {
  console.warn("API_KEY environment variable not set or is empty. AI features will not work.");
}

export const generateInventoryReport = async (items: Item[], logs: LogEntry[], users: User[]): Promise<string> => {
  if (!ai) {
    return "Error: API_KEY is not configured. Please set the API_KEY environment variable to use this feature.";
  }

  const prompt = `
    You are a professional lab manager's assistant. Your task is to generate a concise, insightful, and well-formatted inventory status report based on the provided JSON data.

    **Instructions:**
    1.  Start with a brief, encouraging overview of the lab's status.
    2.  Create a "Low Stock Alert" section. Identify items where the available quantity is less than 20% of the total quantity. List them clearly. If no items are low on stock, state that everything is well-stocked.
    3.  Create a "Recent Activity" section. Summarize the 5 most recent borrowing or returning activities. Mention the item, the user, the action, and the quantity.
    4.  Create a "Most Active Items" section. Identify the top 3 most frequently borrowed items from the logs.
    5.  Conclude with a positive and forward-looking statement.
    6.  Format the entire output as clean HTML. Use tags like <h2> for headings, <ul> and <li> for list items, and <strong> for bold text. Do not include <html>, <head>, or <body> tags.

    **JSON Data:**
    *   **Inventory:** ${JSON.stringify(items)}
    *   **Logs:** ${JSON.stringify(logs)}
    *   **Users:** ${JSON.stringify(users)}
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating report:", error);
    return "An error occurred while generating the report. Please check the console for details.";
  }
};