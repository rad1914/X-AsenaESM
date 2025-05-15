// --- START OF FILE functions.js ---
import axios from "axios";

import baileys from "baileys";
const { jidDecode, delay, generateWAMessageFromContent, proto } = baileys;

import id3 from "browser-id3-writer";

import fileType from "file-type";
const { fromBuffer } = fileType;

import path from "path";
import FormData from "form-data";
import { spawn, exec } from "child_process";
import fetch from "node-fetch";

import jsdom from "jsdom";
const { JSDOM } = jsdom;

import * as cheerio from "cheerio";

import { commands } from "./plugins.js";
import config from "../config.js";

import jsQR from "jsqr";

import fs from "fs";

import { loadMessage } from "../assets/database/StoreDb.js";

import { tmpdir } from "os";

import streamBuffers from "stream-buffers";

import { toBuffer as qrcodeToBuffer } from "qrcode";

// Assume this is in a file like getRandom.js
function getRandom() {

  if (Array.isArray(this) || this instanceof String) {
    return this[Math.floor(Math.random() * this.length)];
  }
  // Assuming 'this' is a number here
  return Math.floor(Math.random() * this);
}

async function m3u82Mp4(m3u8Url) {
  return new Promise((resolve, reject) => {
    // NOTE: ffmpegPath is undefined in the original code.
    // You need to define or pass ffmpegPath to this function.
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'; // Example placeholder

    const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
      initialSize: 100 * 1024,
      incrementAmount: 10 * 1024,
    });
    const tempOutputFile = path.join(tmpdir(), `output_${Date.now()}.mp4`); // Use tmpdir and unique name
    const command = `"${ffmpegPath}" -i "${m3u8Url}" -c copy "${tempOutputFile}"`;
    const ffmpegProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error occurred: ${error.message}`);
        fs.unlink(tempOutputFile, () => reject(error)); // Clean up temp file before rejecting
        return;
      }

      // Read the resulting MP4 file into a buffer
      fs.readFile(tempOutputFile, (err, data) => {
        fs.unlink(tempOutputFile, () => { // Clean up temp file
          if (err) {
            return reject(err);
          }
          // Note: writing to writableStreamBuffer and then getting contents
          // might be redundant if you can just resolve with 'data'.
          // Keeping original logic but it's slightly inefficient.
          writableStreamBuffer.write(data);
          writableStreamBuffer.end();
          resolve(writableStreamBuffer.getContents());
        });
      });
    });
    ffmpegProcess.stderr.on("data", (data) => {
      const progressLine = data.toString();
      const timeMatch = progressLine.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (timeMatch) {
        const elapsedTime = timeMatch[1];
        console.log(`Conversion progress: ${elapsedTime}`);
      }
    });
  });
}


async function buffToFile(buffer, filename) {
  if (!filename) filename = Date.now().toString(); // Ensure filename is a string
  let { ext } = (await fromBuffer(buffer)) || { ext: 'bin' }; // Handle case where file type is unknown
  let filePath = path.join(tmpdir(), `${filename}.${ext}`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

const removeBg = async (imageBuffer) => {
  const formData = new FormData();
  const inputPath = await buffToFile(imageBuffer);
  formData.append("size", "auto");
  formData.append(
    "image_file",
    fs.createReadStream(inputPath),
    path.basename(inputPath)
  );
  try {
    const response = await axios({
      method: "post",
      url: "https://api.remove.bg/v1.0/removebg",
      data: formData,
      responseType: "arraybuffer",
      headers: {
        ...formData.getHeaders(),
        "X-Api-Key": config.REMOVEBG,
      },
      encoding: null,
    });

    // Clean up the temporary input file
    fs.promises.unlink(inputPath).catch(console.error);

    if (response.status !== 200) {
      console.error("Error:", response.status, response.statusText);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error("Request failed:", error);
    // Attempt to clean up the temporary file if it was created
    if (inputPath) {
       fs.promises.unlink(inputPath).catch(console.error);
    }
    return null;
  }
};

async function validatAndSaveDeleted(client, msg) {
  if (msg.type === "protocolMessage") {
    if (msg.message?.protocolMessage?.type === "REVOKE") { // Added optional chaining
      await client.sendMessage(msg.key.remoteJid, { text: "Message Deleted" });
      let jid = config.DELETED_LOG_CHAT;
      if (!jid) {
        console.warn("config.DELETED_LOG_CHAT is not set. Cannot log deleted message.");
        return null; // Return null if log chat is not configured
      }
      let message = await loadMessage(msg.message.protocolMessage.key.id);
      if (!message) {
          console.warn(`Deleted message with ID ${msg.message.protocolMessage.key.id} not found in store.`);
          return null;
      }
      // Ensure message.message exists before passing to generateWAMessageFromContent
      if (!message.message) {
           console.warn(`Message object found for ID ${msg.message.protocolMessage.key.id}, but message.message is null/undefined.`);
           return null;
      }
      const m = generateWAMessageFromContent(jid, message.message, {
        userJid: client.user.id,
      });
      await client.relayMessage(jid, m.message, {
        messageId: m.key.id,
      });
      return m;
    }
  }
  return null; // Return null if not a revoke message
}

export async function readQr(imageBuffer) {
  try {
    const image = await jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;
    // Convert Jimp's buffer to a Uint8ClampedArray required by jsQR
    const rgbaData = new Uint8ClampedArray(data);
    const code = jsQR(rgbaData, width, height);
    if (code) {
      return code.data;
    }
  } catch (err) {
    console.error("Error in readQr:", err); // Log the error
    throw new Error(`Error reading QR code: ${err.message}`);
  }
  return null; // Return null if no QR code is found or error occurs before jsQR
}
// Removed readQr function as it depends on jimp
function createInteractiveMessage(data, options = {}) {
  const { jid, button, header, footer, body } = data;
  let buttons = [];
  for (let i = 0; i < button.length; i++) {
    let btn = button[i];
    let Button = {};
    // Assuming btn.params is already an object suitable for JSON.stringify
    Button.buttonParamsJson = JSON.stringify(btn.params);
    switch (btn.type) {
      case "copy":
        Button.name = "cta_copy";
        break;
      case "url":
        Button.name = "cta_url";
        break;
      case "location":
        Button.name = "send_location";
        break;
      case "address":
        Button.name = "address_message";
        break;
      case "call":
        Button.name = "cta_call";
        break;
      case "reply":
        Button.name = "quick_reply";
        break;
      case "list":
        Button.name = "single_select"; // Note: 'single_select' is for list *messages*, not interactive buttons. Interactive buttons use quick_reply, cta_url, cta_call. This might be a Baileys-specific helper logic or a misunderstanding of interactive message types. Keeping original code structure.
        break;
      default:
        Button.name = "quick_reply"; // Default to quick_reply
        break;
    }
    buttons.push(Button);
  }

  const mess = {
    viewOnceMessage: { // Often wrapped in viewOnceMessage
      message: {
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({ ...body }),
          footer: proto.Message.InteractiveMessage.Footer.create({ ...footer }),
          header: proto.Message.InteractiveMessage.Header.create({ ...header }),
          // Building NativeFlowMessage based on button structure
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: buttons, // This matches the 'Button.name' structure above
          }),
        }),
        // contextInfo can be added here if needed, like mentionedJid, forwardingScore etc.
      },
    },
  };
  // generateWAMessageFromContent handles the full proto message creation and signing
  let optional = generateWAMessageFromContent(jid, mess, options);
  return optional;
}

async function ffmpeg(buffer, args = [], ext = "", ext2 = "") {
  return new Promise(async (resolve, reject) => {
    try {
      // NOTE: ffmpegPath is undefined. Add a definition or pass it as argument.
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'; // Example placeholder

      // Use tmpdir() for temporary files and ensure unique names
      const tmp = path.join(tmpdir(), `${Date.now()}_input.${ext}`);
      const out = path.join(tmpdir(), `${Date.now()}_output.${ext2}`);

      await fs.promises.writeFile(tmp, buffer);

      const ffmpegProcess = spawn(ffmpegPath, ["-y", "-i", tmp, ...args, out]);

      ffmpegProcess.on("error", (err) => {
        // Clean up temp files on error
        fs.promises.unlink(tmp).catch(console.error);
        fs.promises.unlink(out).catch(console.error);
        reject(err);
      });

      ffmpegProcess.on("close", async (code) => {
        // Clean up temp input file
        fs.promises.unlink(tmp).catch(console.error);

        if (code !== 0) {
          // Clean up temp output file on non-zero exit
          fs.promises.unlink(out).catch(console.error);
          reject(new Error(`FFmpeg process exited with code ${code}`));
          return;
        }

        try {
          const processedData = await fs.promises.readFile(out);
          // Clean up temp output file after reading
          fs.promises.unlink(out).catch(console.error);
          resolve(processedData);
        } catch (e) {
          // Clean up temp output file if reading fails
          fs.promises.unlink(out).catch(console.error);
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    ["-vn", "-ac", "2", "-b:a", "128k", "-ar", "44100", "-f", "mp3"],
    ext,
    "mp3"
  );
}


function toPTT(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "128k", // Adjusted bitrate - Opus can be lower
      "-vbr",
      "on",
      "-compression_level",
      "10", // Max compression
      "-ar", "16000" // PTT is typically narrowband 16kHz
    ],
    ext,
    "opus"
  );
}

function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      "-c:v",
      "libx264", // H.264 video codec
      "-c:a",
      "aac",    // AAC audio codec
      "-ab",
      "128k",   // Audio bitrate
      "-ar",
      "44100",  // Audio sample rate
      "-crf",
      "32",     // Constant Rate Factor (lower is higher quality, 18-24 is often good, 32 is quite lossy)
      "-preset",
      "slow",   // Encoding preset (affects speed vs compression efficiency)
      "-movflags", // Ensure fragmented mp4 for streaming (good practice)
      "frag_keyframe+empty_moov"
    ],
    ext,
    "mp4"
  );
}

async function getBuffer(url, options = {}) {
  try {
    const res = await axios({
      method: "get",
      url,
      headers: {
        // Added some standard headers
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "DNT": 1, // Do Not Track
        "Upgrade-Insecure-Requests": 1,
        "Referer": url // Sometimes helps
      },
      ...options, // Allows overriding headers or adding other options
      responseType: "arraybuffer",
    });
     if (res.status !== 200) {
       throw new Error(`Request failed with status code ${res.status}: ${res.statusText}`);
     }
    return res.data;
  } catch (error) {
    console.error(`Error fetching buffer from ${url}:`, error); // Log the specific error
    throw new Error(`Failed to fetch buffer: ${error.message}`);
  }
}
const decodeJid = (jid) => {
  if (!jid) return jid;
  // jidDecode from Baileys handles this correctly
  const decoded = jidDecode(jid);
  return decoded ? `${decoded.user}@${decoded.server}` : jid;
};

async function FiletypeFromUrl(url) {
  try {
    const buffer = await getBuffer(url);
    const out = await fromBuffer(buffer);
    let type;
    if (out) {
      type = out.mime.split("/")[0];
    }
    return { type, buffer };
  } catch (error) {
    console.error(`Error determining file type from URL ${url}:`, error);
    // Return null type but the buffer if fetching succeeded before the error
    // Or re-throw the error if fetching failed
    throw error; // Re-throw the error as getBuffer already logs it
  }
}
function extractUrlFromMessage(message) {
  // Use global flag g to find all matches, and exec in a loop or match()
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = urlRegex.exec(message);
  return match ? match[0] : null; // Returns the first match
}

const removeCommand = async (name) => {
  // Filter approach is cleaner than splicing while iterating
  const initialLength = commands.length;
  const commandRegex = new RegExp(`^${config.HANDLERS}( ?${name})$`, "is");

  const updatedCommands = commands.filter(command => {
      // Check if pattern is defined and matches the command name
      return !(command.pattern !== undefined && commandRegex.test(command.pattern.source));
  });

  if (commands.length !== updatedCommands.length) {
      // Modify in place if possible, or reassign if 'commands' can be reassigned
      commands.length = 0; // Clear original array
      commands.push(...updatedCommands); // Push filtered elements back
      return true; // Command was removed
  }

  return false; // No command matched the name
};
async function igdl(igurl) {
  try {
    const data = `q=${encodeURIComponent(igurl)}&t=media&lang=en`;
    const requestConfig = { // Renamed config to avoid conflict with imported config
      method: "post",
      maxBodyLength: Infinity, // Correct property name
      url: "https://v3.saveig.app/api/ajaxSearch",
      headers: {
        "Accept": "*/*", // Corrected Accept header
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", // Added User-Agent
        "Origin": "https://v3.saveig.app", // Added Origin
        "Referer": "https://v3.saveig.app/", // Added Referer
        "X-Requested-With": "XMLHttpRequest" // Common for AJAX requests
      },
      data: data,
    };

    const response = await axios.request(requestConfig);
    // Check response structure, assuming data.data contains HTML as per original
    if (!response.data || !response.data.data) {
         throw new Error("Invalid response structure from saveig.app");
    }
    const html = response.data.data;

    const $ = cheerio.load(html, { decodeEntities: true });
    const downloadItems = $(".download-items");
    const result = [];

    if (downloadItems.length === 0) {
        // Handle cases where no download items are found (e.g., private profile, invalid URL)
        console.warn("No download items found for URL:", igurl);
        // Attempt to find error message if available
        const errorText = $(".alert.alert-danger").text().trim();
        if (errorText) {
             throw new Error(`saveig.app error: ${errorText}`);
        }
        return []; // Return empty array if no items found and no specific error
    }

    downloadItems.each((index, element) => {
      let url = $(element).find(".download-items__btn > a").attr("href");
      if (url) { // Ensure href attribute exists
         try {
            let decodedUrl = url;
             try {
                 const urlObj = new URL(url);
                 if (urlObj.searchParams.has('file')) {
                     let encodedUrl = urlObj.searchParams.get('file');
                     decodedUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");
                 }
             } catch (e) {
                 console.warn(`Could not parse or decode URL: ${url}`, e);
                 decodedUrl = url; // Fallback to original URL
             }

            result.push(decodedUrl);
         } catch (e) {
             console.error(`Error processing download URL ${url}:`, e);
         }
      }
    });

    return result;
  } catch (error) {
    console.error("Error in igdl:", error.message);
    throw new Error(`Failed to download Instagram content: ${error.message}`);
  }
}

async function aiImage(prompt) {
  try {
    const response = await axios.post(
      "https://socket.xasena.me/generate-image",
      {
        prompt: prompt,
      },
      {
        headers: {
          Accept: "*/*",
          "User-Agent": "Axios/1.x", // Use a standard User-Agent
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // To get the image as a buffer
        // You might need 'responseEncoding: 'binary'' depending on axios version and Node setup
      }
    );

    if (response.status === 400 || response.headers['content-type']?.includes('application/json')) {
       try {
           const errorData = JSON.parse(response.data.toString());
           return errorData; // Return the parsed error object/string
       } catch (jsonError) {
           console.error("Failed to parse error response as JSON:", jsonError);
           return response.data.toString(); // Return raw response if JSON parsing fails
       }
    } else if (response.status !== 200) {
         // Handle other non-200 status codes
         throw new Error(`API request failed with status code ${response.status}: ${response.statusText}`);
    } else {
       // Assuming 200 response with arraybuffer is the image data
       return Buffer.from(response.data);
    }
  } catch (error) {
    console.error("Request to generate-image failed:", error);
    throw new Error(`Failed to generate AI image: ${error.message}`);
  }
}

async function getJson(url, options) {
  try {
    // Use node-fetch as it's already imported, or continue using axios.
    // Sticking with axios as per original function.
    const res = await axios({
      method: "GET",
      url: url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
          // Add other headers if needed, e.g., 'Accept': 'application/json'
      },
      ...options, // Allows overriding headers or adding other options
    });
    if (res.status !== 200) {
       throw new Error(`Request failed with status code ${res.status}: ${res.statusText}`);
    }
    // Axios automatically parses JSON responses if the Content-Type header is set correctly.
    return res.data;
  } catch (err) {
    console.error(`Error fetching JSON from ${url}:`, err.message);
    throw err;
  }
}

const API_KEY = "e6d0cd0023b7ee562a97be33d3c5f524"; // NOTE: This API Key is exposed. It should be in config or env variables.
const BASE_URL = "https://api.musixmatch.com/ws/1.1/";

async function getLyrics(song, artist) {
  try {
    const searchUrl = `${BASE_URL}track.search?q_track=${encodeURIComponent(
      song
    )}&q_artist=${encodeURIComponent(artist)}&f_has_lyrics=1&apikey=${API_KEY}`;
    const searchData = await getJson(searchUrl);

    // Basic validation of Musixmatch response structure
    if (!searchData || searchData.message?.header?.status_code !== 200 || !searchData.message?.body?.track_list) {
        throw new Error(`Musixmatch search API error: ${searchData?.message?.header?.status_code || 'Unknown status'}`);
    }

    const trackList = searchData.message.body.track_list;

    let trackId = null;
    if (trackList.length > 0) {
      trackId = trackList[0].track.track_id;
    } else {
      // If searching by song+artist finds nothing, try searching just by artist
      const allTracksUrl = `${BASE_URL}track.search?q_artist=${encodeURIComponent(
        artist
      )}&apikey=${API_KEY}`;
      const allTracksData = await getJson(allTracksUrl);

      if (!allTracksData || allTracksData.message?.header?.status_code !== 200 || !allTracksData.message?.body?.track_list) {
           console.warn(`Musixmatch artist search API error: ${allTracksData?.message?.header?.status_code || 'Unknown status'}`);
           // No tracks found even by artist
           return null;
      }

      const allTracks = allTracksData.message.body.track_list;
      if (allTracks.length > 0) {
        // Take the first track by this artist if song-specific search failed
        trackId = allTracks[0].track.track_id;
        // Optionally, refine this: iterate through allTracks to find a title similar to 'song'
      }
    }

    if (trackId) {
      const lyricsUrl = `${BASE_URL}track.lyrics.get?track_id=${trackId}&apikey=${API_KEY}`;
      const lyricsData = await getJson(lyricsUrl);

      if (!lyricsData || lyricsData.message?.header?.status_code !== 200 || !lyricsData.message?.body?.lyrics?.lyrics_body) {
           console.warn(`Musixmatch lyrics API error for trackId ${trackId}: ${lyricsData?.message?.header?.status_code || 'Unknown status'}`);
           // Lyrics not found for this track ID
           return null;
      }

      let lyrics = lyricsData.message.body.lyrics.lyrics_body;
      const disclaimer =
        "********************** This Lyrics is NOT for Commercial use **********************";
      // Remove the disclaimer and the trailing number in parentheses (e.g., "(123)")
      lyrics = lyrics.replace(disclaimer, "").replace(/\s*\(\d+\)$/, "").trim();

      return {
        artist_name: artist,
        song,
        lyrics: lyrics,
      };
    }
  } catch (error) {
    console.error("Error fetching lyrics:", error.message);
    // Re-throw or return null depending on desired error handling
    throw error;
  }

  return null; // Return null if no track ID or lyrics were found
}

async function XKCDComic() {
  try {
    const response = await axios.get('https://xkcd.com/info.0.json');
    const latestComic = response.data.num;
    const randomComicNum = Math.floor(Math.random() * latestComic) + 1;
    const comicResponse = await axios.get(`https://xkcd.com/${randomComicNum}/info.0.json`);
    return {
      imageUrl: comicResponse.data.img,
      title: comicResponse.data.title,
      alt: comicResponse.data.alt
    };
  } catch (error) {
    console.error("Error fetching XKCD comic:", error);
    throw error;
  }
}

async function pm2Uptime() {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec('pm2 jlist', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing pm2 jlist: ${error}`);
          return reject(error);
        }
        try {
          const pm2List = JSON.parse(stdout);
          const botProcess = pm2List.find(proc => proc.name === 'x-asena');
          if (botProcess) {
            const uptime = Date.now() - botProcess.pm2_env.pm_uptime;
            return resolve(uptime);
          }
          return reject(new Error('Bot process not found in PM2 list'));
        } catch (parseError) {
          console.error(`Error parsing PM2 output: ${parseError}`);
          return reject(parseError);
        }
      });
    });
  } catch (error) {
    console.error('Error in pm2Uptime:', error);
    throw error;
  }
}

// Placeholder function for textToImg
async function textToImg(text) {
  console.warn(`textToImg called with: "${text}". This is a placeholder function.`);
  return Promise.resolve(Buffer.from("placeholder_image_data")); // Return a placeholder buffer
}

// Exporting all functions and utilities
export {
  parseTimeToSeconds,
  toAudio,
  toPTT,
  toVideo,
  ffmpeg,
  removeBg,
  FiletypeFromUrl,
  removeCommand,
  getBuffer,
  extractUrlFromMessage,
  decodeJid,
  isAdmin,
  webp2mp4,
  validatAndSaveDeleted,
  webp2png,
  parseJid,
  parsedJid,
  getLyrics,
  getJson,
  isIgUrl,
  isUrl,
  getUrl,
  qrcode,
  aiImage,
  secondsToDHMS,
  formatBytes,
  sleep,
  clockString,
  runtime,
  validateQuality,
  AddMp3Meta,
  Bitly,
  isNumber,
  getRandom,
  createInteractiveMessage,
  igdl,
  m3u82Mp4,
  XKCDComic,
  pm2Uptime
};


// Define helper functions/properties that were attached to module.exports directly
function parseTimeToSeconds(timeString) {
  // Check if timeString is in HH:MM:SS or MM:SS format
  const parts = timeString.split(":").map(Number);
  if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
  } else {
      console.warn(`Invalid time string format: ${timeString}`);
      return 0; // Return 0 for invalid format
  }
}

async function isAdmin (jid, user, client) {
  try {
    const groupMetadata = await client.groupMetadata(jid);
    // Check if groupMetadata is valid
    if (!groupMetadata || !groupMetadata.participants) {
        console.warn(`Could not get group metadata for ${jid} or no participants found.`);
        return false;
    }
    const groupAdmins = groupMetadata.participants
      .filter((participant) => participant.admin !== null) // Filter participants who are admins
      .map((participant) => participant.id); // Map to their JIDs

    // Baileys JIDs are typically in the format XXXXXXXXXXX@s.whatsapp.net
    // decodeJid should convert potentially complex JIDs to the standard format
    const userJid = decodeJid(user);

    return groupAdmins.includes(userJid);
  } catch (error) {
     console.error(`Error checking isAdmin status for ${user} in group ${jid}:`, error);
     return false; // Return false on error
  }
}

async function webp2mp4 (source) {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);

  if (isUrl) {
      form.append("new-image-url", source);
      form.append("new-image", ""); // Ensure new-image is empty for URL input
  } else if (Buffer.isBuffer(source)) {
       form.append("new-image-url", ""); // Ensure new-image-url is empty for buffer input
       form.append("new-image", source, { filename: "image.webp", contentType: "image/webp" }); // Pass buffer directly with filename and content type
  } else {
       throw new Error("Invalid source type: Must be URL string or Buffer");
  }

  let res = await fetch("https://ezgif.com/webp-to-mp4", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
       throw new Error(`ezgif.com webp-to-mp4 upload failed with status ${res.status}`);
  }

  let html = await res.text();
  const dom = new JSDOM(html); // Use const for JSDOM instance
  let { document } = dom.window;
  let form2 = new FormData();
  let obj = {};
  // Find necessary hidden inputs from the response HTML
  for (let input of document.querySelectorAll("form input[name][type='hidden']")) {
    obj[input.name] = input.value;
    form2.append(input.name, input.value);
  }

   // Find the conversion form and its action URL
   const convertForm = document.querySelector('form[action^="/webp-to-mp4/"]');
   if (!convertForm) {
       throw new Error("Could not find conversion form on ezgif.com result page");
   }
   const convertUrl = new URL(convertForm.action, 'https://ezgif.com').toString();


  // Submit the conversion form
  let res2 = await fetch(convertUrl, {
    method: "POST",
    body: form2,
  });

  if (!res2.ok) {
       throw new Error(`ezgif.com webp-to-mp4 conversion failed with status ${res2.status}`);
  }

  let html2 = await res2.text();
  const dom2 = new JSDOM(html2); // Use const for JSDOM instance
  let { document: document2 } = dom2.window;

  // Find the resulting video source URL
  const videoSource = document2.querySelector("div#output > p.outfile > video > source");
  if (!videoSource || !videoSource.src) {
       // Look for error messages if video source isn't found
       const errorMessage = document2.querySelector(".alert.alert-danger")?.textContent?.trim();
       if (errorMessage) {
           throw new Error(`ezgif.com conversion error: ${errorMessage}`);
       }
       throw new Error("Could not find output video source on ezgif.com result page");
  }

  // Construct the full URL relative to res2.url
  return new URL(videoSource.src, res2.url).toString();
}

async function webp2png (source) {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);

  if (isUrl) {
      form.append("new-image-url", source);
      form.append("new-image", "");
  } else if (Buffer.isBuffer(source)) {
       form.append("new-image-url", "");
       form.append("new-image", source, { filename: "image.webp", contentType: "image/webp" });
  } else {
       throw new Error("Invalid source type: Must be URL string or Buffer");
  }

  // Note: The URL uses s6.ezgif.com, while the action URL later uses ezgif.com.
  // Need to be careful with base URLs for relative paths.
  let res = await fetch("https://s6.ezgif.com/webp-to-png", {
    method: "POST",
    body: form,
  });

   if (!res.ok) {
       throw new Error(`ezgif.com webp-to-png upload failed with status ${res.status}`);
   }


  let html = await res.text();
  const dom = new JSDOM(html); // Use const
  let { document } = dom.window;
  let form2 = new FormData();
  let obj = {};
   // Find necessary hidden inputs from the response HTML
   for (let input of document.querySelectorAll("form input[name][type='hidden']")) {
     obj[input.name] = input.value;
     form2.append(input.name, input.value);
   }

   // Find the conversion form and its action URL
   const convertForm = document.querySelector('form[action^="/webp-to-png/"]');
   if (!convertForm) {
        throw new Error("Could not find conversion form on ezgif.com result page");
   }
   // Use the original domain (s6.ezgif.com) for the conversion URL if the form action is relative
   const convertUrl = new URL(convertForm.action, res.url).toString();


  let res2 = await fetch(convertUrl, {
    method: "POST",
    body: form2,
  });

  if (!res2.ok) {
      throw new Error(`ezgif.com webp-to-png conversion failed with status ${res2.status}`);
  }

  let html2 = await res2.text();
  // console.log(html2); // Keep console.log for debugging if needed
  const dom2 = new JSDOM(html2); // Use const
  let { document: document2 } = dom2.window;

   // Find the resulting image source URL
  const imgSource = document2.querySelector("div#output > p.outfile > img");
   if (!imgSource || !imgSource.src) {
        // Look for error messages if image source isn't found
        const errorMessage = document2.querySelector(".alert.alert-danger")?.textContent?.trim();
        if (errorMessage) {
            throw new Error(`ezgif.com conversion error: ${errorMessage}`);
        }
       throw new Error("Could not find output image source on ezgif.com result page");
   }

   // Construct the full URL relative to res2.url
  return new URL(imgSource.src, res2.url).toString();
}

function parseJid(text = "") {
    // Ensure text is a string before using matchAll
    if (typeof text !== 'string') {
        console.warn(`parseJid received non-string input: ${typeof text}`);
        return [];
    }
    // Updated regex to handle potentially empty matches or edge cases better
    const matches = [...text.matchAll(/@(\d{5,16}|0)/g)];
    return matches.map(v => `${v[1]}@s.whatsapp.net`);
}

function parsedJid(text = "") {
     // Ensure text is a string before using matchAll
     if (typeof text !== 'string') {
         console.warn(`parsedJid received non-string input: ${typeof text}`);
         return [];
     }
     // This function seems to extract bare numbers and append '@s.whatsapp.net'.
     // It might accidentally match non-JID numbers in text. Use with caution.
    const matches = [...text.matchAll(/(\d{5,16}|0)/g)]; // Matches 5-16 digits or '0'
    return matches.map(v => `${v[1]}@s.whatsapp.net`);
}


const isIgUrl = (url) => {
    if (typeof url !== 'string') return false;
    // Added more robust regex that includes common subdomains and paths
    return /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am|instagr\.com)\/(?:.*?\/)?(?:p|reel|tv)\/(?:[\w-]+)/i.test(url);
};

const isUrl = (url) => {
    if (typeof url !== 'string') return false;
    // Standard URL validation regex
    return new RegExp(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
        "gi"
    ).test(url);
};

const getUrl = (url) => {
    if (typeof url !== 'string') return null;
     // Return the match result (an array of URLs found) or null
    return url.match(
      new RegExp(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
        "gi"
      )
    );
};

const qrcode = async (string) => {
    // qrcodeToBuffer is imported at the top from 'qrcode'
    try {
        let buff = await qrcodeToBuffer(string);
        return buff;
    } catch (err) {
        console.error("Error generating QR code:", err);
        throw err; // Re-throw the error
    }
};

const secondsToDHMS = (seconds) => {
    // Ensure seconds is a number
    seconds = Number(seconds);
    if (isNaN(seconds) || seconds < 0) {
        return "0 Seconds";
    }

    const days = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    seconds = Math.floor(seconds);

    const parts = [];

    if (days) parts.push(`${days} Days`);
    if (hours) parts.push(`${hours} Hours`);
    if (minutes) parts.push(`${minutes} Minutes`);
    if (seconds) parts.push(`${seconds} Seconds`);

    if (parts.length === 0) return "0 Seconds"; // Handle input 0
    return parts.join(" ");
};

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// sleep is already imported as delay from baileys
const sleep = delay;

const clockString = (duration) => {
    if (typeof duration !== 'number' || duration < 0) {
        return "00:00:00";
    }
    const totalSeconds = Math.floor(duration / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor((totalSeconds / 60) % 60);
    const hours = Math.floor(totalSeconds / 3600);

    const paddedHours = hours < 10 ? "0" + hours : hours;
    const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
    const paddedSeconds = seconds < 10 ? "0" + seconds : seconds;

    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
};

const runtime = () => {
    // process.uptime() returns seconds since process started
    const duration = process.uptime();
    const seconds = Math.floor(duration % 60);
    const minutes = Math.floor((duration / 60) % 60);
    const hours = Math.floor((duration / (60 * 60)) % 24); // Clock should wrap around 24h

    const formattedTime = `${hours
      .toString()
      .padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return formattedTime;
};

const validateQuality = (quality) => {
    if (typeof quality !== 'string') return false;
    let valid = ["144p", "240p", "360p", "480p", "720p", "1080p"];
    return valid.includes(quality);
};

const AddMp3Meta = async (
  songbuffer,
  coverBuffer,
  options = { title: "X-Asena Whatsapp bot", artist: ["Xasena"] } // artist should be an array for id3-writer TPE1
) => {
  try {
    // Ensure songbuffer is a Buffer
    if (!Buffer.isBuffer(songbuffer)) {
      // Assuming getBuffer function works and throws on error
      songbuffer = await getBuffer(songbuffer);
    }
    // Ensure coverBuffer is a Buffer
    if (!Buffer.isBuffer(coverBuffer)) {
       // Assuming getBuffer function works and throws on error
      coverBuffer = await getBuffer(coverBuffer);
    }

    // Ensure options.artist is an array
    const artists = Array.isArray(options.artist) ? options.artist : [options.artist];

    const writer = new id3(songbuffer);
    writer
      .setFrame("TIT2", options.title || "Unknown Title") // Add default title
      .setFrame("TPE1", artists) // Set artists (array)
      .setFrame("APIC", {
        type: 3, // 3 is for Front Cover
        data: coverBuffer,
        description: "Cover", // Add a description
      });

    writer.addTag();
    return Buffer.from(writer.arrayBuffer); // id3-writer produces an ArrayBuffer, convert to Buffer
  } catch (error) {
      console.error("Error adding MP3 metadata:", error);
      throw new Error(`Failed to add MP3 metadata: ${error.message}`);
  }
};

const Bitly = async (url) => {
    // NOTE: Bitly API Key is exposed. Move to config or env variables.
    const BITLY_API_KEY = "6e7f70590d87253af9359ed38ef81b1e26af70fd"; // Exposed key

    return new Promise((resolve, reject) => {
      // Import BitlyClient here or at the top
      // Importing here makes it lazy, only loaded when Bitly() is called
      import("bitly").then(({ BitlyClient }) => {
            const bitly = new BitlyClient(BITLY_API_KEY);
            bitly
                .shorten(url)
                .then((a) => {
                    // The structure might be { link: 'short_url' }
                    if (a && a.link) {
                       resolve(a.link); // Resolve with the shortened URL string
                    } else {
                       reject(new Error("Bitly API did not return a shortened link."));
                    }
                })
                .catch((A) => {
                    console.error("Bitly shortening failed:", A);
                    reject(A);
                });
        }).catch(importErr => {
             console.error("Failed to import 'bitly':", importErr);
             reject(importErr);
        });
    });
};

 const isNumber = (value) => typeof value === 'number' && !isNaN(value);

// Keeping original prototype extension for direct conversion, but advise against this pattern.
if (!Number.prototype.isNumber) {
  Object.defineProperty(Number.prototype, 'isNumber', {
    value: function() {
      const int = parseInt(this);
      return typeof int === "number" && !isNaN(int);
    },
    enumerable: false // Make it non-enumerable
  });
}

if (!String.prototype.isNumber) {
   Object.defineProperty(String.prototype, 'isNumber', {
     value: function() {
       const int = parseInt(this);
       return typeof int === "number" && !isNaN(int);
     },
     enumerable: false // Make it non-enumerable
   });
 }


if (!Array.prototype.getRandom) {
  Object.defineProperty(Array.prototype, 'getRandom', {
    value: function() {
      if (this.length === 0) return undefined; // Handle empty array
      return this[Math.floor(Math.random() * this.length)];
    },
    enumerable: false // Make it non-enumerable
  });
}

if (!String.prototype.getRandom) {
    Object.defineProperty(String.prototype, 'getRandom', {
      value: function() {
        if (this.length === 0) return ''; // Handle empty string
        return this[Math.floor(Math.random() * this.length)];
      },
      enumerable: false // Make it non-enumerable
    });
}

export {
  textToImg
};