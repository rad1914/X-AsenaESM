import {
  command,
  getUrl,
  // igdl, // igdl was imported but not used in the original function
  isIgUrl,
  isPrivate,
  getJson,
} from "../../lib/index.js";

command(
  {
    pattern: "insta",
    fromMe: isPrivate,
    desc: "To download instagram media",
    type: "user",
  },
  async (message, match) => {
    match = match || message.reply_message.text;
    if (!match) return await message.sendMessage(message.jid, "Give me a link");
    const urls = getUrl(match.trim()); // getUrl might return an array
    if (!urls || urls.length === 0) return await message.sendMessage(message.jid, "Invalid link");
    const url = urls[0]; // Take the first URL found

    if (!isIgUrl(url)) // Check the extracted URL
      return await message.sendMessage(message.jid, "Invalid Instagram link");
    // The second check isIgUrl(match.trim()) might be redundant if getUrl already validates/extracts well
    // if (!isIgUrl(match.trim())) 
    //   return await message.sendMessage(message.jid, "Invalid Instagram link");
    try {
      const data = await getJson(
        `https://api.thexapi.xyz/api/v1/download/instagram?url=${encodeURIComponent(url)}` // Encode URL
      );

      if (!data || !data.data || data.data?.length == 0)
        return await message.sendMessage(
          message.jid,
          "No media found on the link"
        );
      
      for (const item of data.data) { // Changed to for...of for async/await safety if sendFile is truly async
        if (item.url) { // Assuming the API returns objects with a 'url' property
           await message.sendFile(item.url);
        } else if (typeof item === 'string') { // If API returns array of strings
           await message.sendFile(item);
        }
      }
    } catch (e) {
      console.error("Instagram download error:", e); // Log error for debugging
      await message.sendMessage(message.jid, "Error: " + e.message);
    }
  }
);

export default {};