import pkg from 'file-type';
const { fromBuffer } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getJson } from "../lib/index.js"; // Assuming index.js is the entry point for lib
import "dotenv/config.js"; // For ESM, .config() is often appended with .js

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GEMINI_API); // Prefer GEMINI_API_KEY

function fileToGenerativePart(buff, mimeType) {
  if (!buff || !mimeType) return undefined; // handle cases where imageBuff might be null
  return {
    inlineData: {
      data: Buffer.from(buff).toString("base64"),
      mimeType,
    },
  };
}

async function generateContentWithImage(prompt, imageBuff) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
  const imagePart = fileToGenerativePart(
    imageBuff,
    imageBuff ? (await fromBuffer(imageBuff))?.mime : undefined // Check for null fromBuffer
  );
  
  const parts = [prompt];
  if (imagePart) {
    parts.push(imagePart);
  }
  
  const result = await model.generateContent(parts);
  return result.response.text();
}

async function generateContentTextOnly(prompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}


async function gemini(prompt, imageBuff, options = {}) { // options seems unused
  const { promptText, promptImage } = await getJson(
    `https://gist.githubusercontent.com/Neeraj-x0/d80f8454b0f1c396a722b12cd159945e/raw` // Using raw content link
  );

  try {
    if (imageBuff) {
      const fullPrompt = (promptImage || "") + prompt;
      return await generateContentWithImage(fullPrompt, imageBuff);
    } else {
      const fullPrompt = (promptText || "") + prompt;
      return await generateContentTextOnly(fullPrompt);
    }
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return error.message?.replace("[GoogleGenerativeAI Error]:", "").trim() || "Error processing request with Gemini AI.";
  }
}

export default gemini;