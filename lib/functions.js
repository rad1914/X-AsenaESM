// --- START OF FILE functions.js --- (This line is a comment and will be removed in the ESM output)

import axios from "axios";
import baileys from 'baileys';
const {
  jidDecode,
  delay,
  generateWAMessageFromContent,
  proto
} = baileys;

import id3 from "browser-id3-writer";
const { fileTypeFromBuffer } = await import('file-type');
import path from "path";
import FormData from "form-data";
import { spawn, exec } from "child_process";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import cheerio from "cheerio";
import { commands } from "./plugins.js"; // Assuming plugins.js or plugins/index.js
import config from "../config.js"; // Assuming config.js
import jsQR from "jsqr";
import fs from "fs";
import jimp from "jimp";
import { loadMessage } from "../assets/database/StoreDb.js"; // Assuming StoreDb.js
import { tmpdir } from "os";
import streamBuffers from "stream-buffers";
import Bitly from 'bitly';
import { toBuffer as qrToBuffer } from "qrcode";

// Note: ffmpegPath is used in m3u82Mp4 but not defined in this file.
// It must be an externally available variable (e.g., global, or from an import not shown).
// This was also an issue in the original CommonJS code if not defined elsewhere.
// const ffmpegPath = "path/to/your/ffmpeg"; // Example: You might need to define or import it

export async function m3u82Mp4(m3u8Url) {
  return new Promise((resolve, reject) => {
    const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
      initialSize: 100 * 1024,
      incrementAmount: 10 * 1024,
    });
    const tempOutputFile = "output.mp4"; // Consider using a unique name in tmpdir
    // Ensure ffmpegPath is defined, e.g., imported from config or set globally
    if (typeof ffmpegPath === 'undefined') {
      return reject(new Error("ffmpegPath is not defined. Please configure the path to ffmpeg."));
    }
    const command = `"${ffmpegPath}" -i "${m3u8Url}" -c copy "${tempOutputFile}"`;
    const ffmpegProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error occurred: ${error.message}`);
        return reject(error);
      }

      fs.readFile(tempOutputFile, (err, data) => {
        if (err) {
          return reject(err);
        }
        writableStreamBuffer.write(data);
        writableStreamBuffer.end();
        fs.unlink(tempOutputFile, (unlinkErr) => { // Use async unlink and handle its error
          if (unlinkErr) {
            console.error(`Error unlinking temp file: ${unlinkErr.message}`);
            // Potentially reject or just log, depending on desired behavior
          }
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

export async function buffToFile(buffer, filename) {
  if (!filename) filename = Date.now();
  let { ext } = await fromBuffer(buffer);
  let filePath = path.join(tmpdir(), `${filename}.${ext}`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export const removeBg = async (imageBuffer) => {
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
      // encoding: null, // Axios for arraybuffer doesn't need encoding: null
    });

    if (response.status !== 200) {
      console.error("Error:", response.status, response.statusText);
      fs.promises.unlink(inputPath).catch(err => console.error("Failed to unlink temp file for removeBg:", err));
      return null;
    }
    fs.promises.unlink(inputPath).catch(err => console.error("Failed to unlink temp file for removeBg:", err));
    return response.data;
  } catch (error) {
    console.error("Request failed:", error);
    fs.promises.unlink(inputPath).catch(err => console.error("Failed to unlink temp file for removeBg:", err));
    return null;
  }
};

export async function validatAndSaveDeleted(client, msg) {
  if (msg.type === "protocolMessage") {
    if (msg.message.protocolMessage.type === "REVOKE") {
      await client.sendMessage(msg.key.remoteJid, { text: "Message Deleted" });
      let jid = config.DELETED_LOG_CHAT;
      let message = await loadMessage(msg.message.protocolMessage.key.id);
      if (!message || !message.message) { // Add a check for message content
        console.error("Failed to load message for deleted log or message content is missing.");
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
}
export async function textToImg(text) {
  try {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    words.forEach((word) => {
      if (line.length + word.length < 30) {
        line += word + " ";
      } else {
        lines.push(line.trim());
        line = word + " ";
      }
    });
    lines.push(line.trim());
    text = lines.join("\n");
    const font = await jimp.loadFont(jimp.FONT_SANS_64_WHITE);
    // Measure text more accurately for canvas sizing
    let maxWidth = 0;
    lines.forEach(l => {
      const lineWidth = jimp.measureText(font, l);
      if (lineWidth > maxWidth) {
        maxWidth = lineWidth;
      }
    });
    const textHeight = jimp.measureTextHeight(font, text, maxWidth); // Provide maxWidth for better height calculation with wrapping
    
    const padding = 20; // Add some padding
    const canvasWidth = maxWidth + padding * 2;
    const canvasHeight = textHeight + padding * 2;

    const image = new jimp(canvasWidth, canvasHeight, 0x075e54ff);
    const x = padding;
    const y = padding;
    image.print(font, x, y, { text: text, alignmentX: jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: jimp.VERTICAL_ALIGN_MIDDLE }, maxWidth, textHeight);
    image.shadow({ blur: 3, x: 6, y: 5, color: "#000000" }); // color was hex string, not number
    const buffer = await image.getBufferAsync(jimp.MIME_PNG);
    return buffer;
  } catch (err) {
    console.error("Error in textToImg:", err);
    throw new Error(err.message || err);
  }
}

export async function readQr(imageBuffer) {
  try {
    const image = await jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height);
    if (code) {
      return code.data;
    }
  } catch (err) {
    throw new Error(`Error reading QR code: ${err.message}`);
  }
  return null;
}

export function createInteractiveMessage(data, options = {}) {
  const { jid, button, header, footer, body } = data;
  let buttons = [];
  for (let i = 0; i < button.length; i++) {
    let btn = button[i];
    let Button = {};
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
        Button.name = "single_select";
        break;
      default:
        Button.name = "quick_reply";
        break;
    }
    buttons.push(Button);
  }
  const mess = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({ text: body?.text || "" }), // Ensure body and text exist
          footer: proto.Message.InteractiveMessage.Footer.create({ text: footer?.text || "" }), // Ensure footer and text exist
          header: proto.Message.InteractiveMessage.Header.create({ ...(header || {}) }), // Ensure header exists
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create(
            {
              buttons: buttons,
            }
          ),
        }),
      },
    },
  };
  let optional = generateWAMessageFromContent(jid, mess, options);
  return optional;
}

export function ffmpeg(buffer, args = [], ext = "", ext2 = "") {
  return new Promise(async (resolve, reject) => {
    try {
      let tmp = path.join(tmpdir(), `${Date.now()}.${ext}`);
      let out = `${tmp}.${ext2}`;
      await fs.promises.writeFile(tmp, buffer);
      const ffmpegProcess = spawn("ffmpeg", ["-y", "-i", tmp, ...args, out])
        .on("error", reject)
        .on("close", async (code) => {
          try {
            await fs.promises.unlink(tmp);
            if (code !== 0) {
              reject(new Error(`FFmpeg process exited with code ${code}`));
              return;
            }
            const processedData = await fs.promises.readFile(out);
            await fs.promises.unlink(out);
            resolve(processedData);
          } catch (e) {
            reject(e);
          }
        });
    } catch (e) {
      reject(e);
    }
  });
}

export function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    ["-vn", "-ac", "2", "-b:a", "128k", "-ar", "44100", "-f", "mp3"],
    ext,
    "mp3"
  );
}

export function toPTT(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
      "-vbr",
      "on",
      "-compression_level",
      "10",
    ],
    ext,
    "opus"
  );
}

export function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-ab",
      "128k",
      "-ar",
      "44100",
      "-crf",
      "32",
      "-preset",
      "slow",
    ],
    ext,
    "mp4"
  );
}

export async function getBuffer(url, options = {}) {
  try {
    const res = await axios({
      method: "get",
      url,
      headers: {
        DNT: 1,
        "Upgrade-Insecure-Request": 1,
        ...(options.headers || {}), // Merge custom headers
      },
      ...options,
      responseType: "arraybuffer",
    });
    return res.data;
  } catch (error) {
    // Log the error for better debugging
    console.error(`Error fetching buffer from ${url}:`, error.message);
    // Optionally, rethrow a more specific error or handle it
    throw new Error(`Failed to get buffer from URL: ${error.message}`);
  }
}
export const decodeJid = (jid) => {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
    const decode = jidDecode(jid) || {};
    return decode.user && decode.server
      ? `${decode.user}@${decode.server}`
      : jid;
  } else {
    return jid;
  }
};
export async function FiletypeFromUrl(url) {
  const buffer = await getBuffer(url);
  const out = await fromBuffer(buffer);
  let type;
  if (out) {
    type = out.mime.split("/")[0];
  }
  return { type, buffer };
}
export function extractUrlFromMessage(message) {
  if (typeof message !== 'string') return null; // Ensure message is a string
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = urlRegex.exec(message);
  return match ? match[0] : null;
}

export const removeCommand = async (name) => {
  return new Promise((resolve, reject) => {
    let found = false;
    for (let i = commands.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
      const command = commands[i];
      if (
        command.pattern !== undefined &&
        command.pattern.test(new RegExp(`${config.HANDLERS}( ?${name})`, "is"))
      ) {
        commands.splice(i, 1);
        found = true;
        // If only one command should be removed, break here.
        // If multiple commands could match and all should be removed, continue.
        // For now, assume only one match or the first match is sufficient.
        break; 
      }
    }
    resolve(found);
  });
};
export async function igdl(igurl) {
  const data = `q=${encodeURIComponent(igurl)}&t=media&lang=en`;
  const axiosConfig = { // Renamed from 'config' to avoid conflict with imported 'config'
    method: "post",
    maxBodyLength: Infinity,
    url: "https://v3.saveig.app/api/ajaxSearch",
    headers: {
      Accept: "/", // Corrected: 'Accept': '*/*' is more common for "any"
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    data: data,
  };

  const response = await axios.request(axiosConfig);
  const html = response.data.data;

  const $ = cheerio.load(html, { decodeEntities: true });
  const downloadItems = $(".download-items");
  const result = [];

  downloadItems.each((index, element) => {
    let url = $(element).find(".download-items__btn > a").attr("href");
    if (url) { // Check if URL exists
        if (url.includes("file")) {
        let newUrl = new URL(url);
        let encodedUrl = newUrl.searchParams.get("file");
        if (encodedUrl) { // Check if encodedUrl exists
            let decodedUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");
            result.push(decodedUrl);
        }
        } else {
        result.push(url);
        }
    }
  });

  return result;
}

export function aiImage(prompt) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        "https://socket.xasena.me/generate-image",
        {
          prompt: prompt,
        },
        {
          headers: {
            Accept: "*/*",
            "User-Agent": "Thunder Client (https://www.thunderclient.com)",
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      )
      .then(function (response) {
        // It's unusual for a 400 to resolve with data, usually it's an error.
        // However, sticking to original logic.
        if (response.status === 400) { 
          resolve(response.data); // Potentially a JSON error message as ArrayBuffer
        } else {
          resolve(Buffer.from(response.data, "binary"));
        }
      })
      .catch(function (error) {
        reject(error);
      });
  });
}

export async function getJson(url, options = {}) { // Ensure options is an object
  try {
    const res = await axios({
      method: "GET",
      url: url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
        ...(options.headers || {}), // Merge custom headers
      },
      ...options, // Spread other options like params, data, etc.
    });
    return res.data;
  } catch (err) {
    // It's better to throw or return a consistent error structure
    console.error(`Error fetching JSON from ${url}:`, err.message);
    // throw err; // Or return specific error object: return { error: true, message: err.message };
    return err; // Original behavior was to return the error object itself
  }
}

const API_KEY = "e6d0cd0023b7ee562a97be33d3c5f524"; // This should ideally be in config
const BASE_URL = "https://api.musixmatch.com/ws/1.1/";

export async function getLyrics(song, artist) {
  try {
    const searchUrl = `${BASE_URL}track.search?q_track=${encodeURIComponent(
      song
    )}&q_artist=${encodeURIComponent(artist)}&f_has_lyrics=1&apikey=${API_KEY}`;
    const searchData = await getJson(searchUrl);
    
    // Add checks for response structure
    if (!searchData || !searchData.message || !searchData.message.body || !searchData.message.body.track_list) {
        console.error("Invalid response structure from Musixmatch search:", searchData);
        return null;
    }
    const trackList = searchData.message.body.track_list;

    let trackId = null;
    if (trackList.length > 0) {
      trackId = trackList[0].track.track_id;
    } else {
      // Try searching only by artist if song+artist yields no results with lyrics
      const artistSearchUrl = `${BASE_URL}track.search?q_artist=${encodeURIComponent(
        artist
      )}&f_has_lyrics=1&s_track_rating=desc&apikey=${API_KEY}`; // Added sorting by track rating
      const artistSearchData = await getJson(artistSearchUrl);
      if (artistSearchData && artistSearchData.message && artistSearchData.message.body && artistSearchData.message.body.track_list && artistSearchData.message.body.track_list.length > 0) {
          // This part is tricky: which song to pick if artist has many?
          // The original code picked the first from a search without the song title.
          // This might not be the intended song.
          // For now, let's stick to the original logic if it finds *any* track by artist.
          // A better approach might be to inform the user no specific song match found.
          const allTracks = artistSearchData.message.body.track_list;
          if (allTracks.length > 0) {
            // Maybe try to find one that somewhat matches the song title if possible, or just take the first
            const foundSong = allTracks.find(t => t.track.track_name.toLowerCase().includes(song.toLowerCase()));
            trackId = foundSong ? foundSong.track.track_id : allTracks[0].track.track_id;
          }
      }
    }

    if (trackId) {
      const lyricsUrl = `${BASE_URL}track.lyrics.get?track_id=${trackId}&apikey=${API_KEY}`;
      const lyricsData = await getJson(lyricsUrl);
      if (!lyricsData || !lyricsData.message || !lyricsData.message.body || !lyricsData.message.body.lyrics) {
        console.error("Invalid response structure from Musixmatch lyrics get:", lyricsData);
        return null;
      }
      let lyrics = lyricsData.message.body.lyrics.lyrics_body;
      if (!lyrics) return null; // No lyrics body

      const disclaimerRegex = /\s*\*{7,}.*This Lyrics is NOT for Commercial use.*?\*{7,}\s*/is;
      lyrics = lyrics.replace(disclaimerRegex, "").trim();
      lyrics = lyrics.replace(/\(\d+\)$/, "").trim(); // Remove trailing (숫자)
      lyrics = lyrics.replace(/\s*\.{3}音楽\.\.{3}\s*$/i, "").trim(); // Remove specific non-English trailer
      
      // Attempt to get the actual song name and artist from the track details if available
      const trackInfoUrl = `${BASE_URL}track.get?track_id=${trackId}&apikey=${API_KEY}`;
      const trackInfoData = await getJson(trackInfoUrl);
      let actualArtist = artist;
      let actualSong = song;
      if (trackInfoData && trackInfoData.message && trackInfoData.message.body && trackInfoData.message.body.track) {
        actualArtist = trackInfoData.message.body.track.artist_name || artist;
        actualSong = trackInfoData.message.body.track.track_name || song;
      }

      return {
        artist_name: actualArtist,
        song: actualSong,
        lyrics: lyrics,
      };
    }
  } catch (error) {
    console.error("Error in getLyrics:", error.message);
    // throw error; // Re-throwing might halt operations, decide based on use case
  }

  return null;
}

export const parseTimeToSeconds = (timeString) => {
  const parts = timeString.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0; // Or throw error for invalid format
};

export const isAdmin = async (jid, user, client) => {
  const groupMetadata = await client.groupMetadata(jid);
  const groupAdmins = groupMetadata.participants
    .filter((participant) => participant.admin !== null)
    .map((participant) => participant.id);

  return groupAdmins.includes(decodeJid(user));
};

export const webp2mp4 = async (source) => {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);
  form.append("new-image-url", isUrl ? source : "");
  if (!isUrl) { // Append file only if it's not a URL
    form.append("new-image", source, "image.webp"); // Assuming source is a Buffer or Stream
  }
  
  let res = await fetch("https://ezgif.com/webp-to-mp4", {
    method: "POST",
    body: form,
  });
  let html = await res.text();
  let { document } = new JSDOM(html).window;
  let form2 = new FormData();
  let obj = {};
  document.querySelectorAll("form input[name]").forEach(input => {
    obj[input.name] = input.value;
    form2.append(input.name, input.value);
  });

  if (!obj.file) { // If file input is not found, ezgif might have failed
      console.error("ezgif webp2mp4: could not find file input in first response");
      const errorMsg = document.querySelector('.errorרישום')?.textContent;
      if(errorMsg) console.error("ezgif error:", errorMsg);
      throw new Error("Failed to process image with ezgif (step 1).");
  }

  let res2 = await fetch("https://ezgif.com/webp-to-mp4/" + obj.file, {
    method: "POST",
    body: form2,
  });
  let html2 = await res2.text();
  let { document: document2 } = new JSDOM(html2).window;
  const videoSource = document2.querySelector("div#output > p.outfile > video > source");
  if (!videoSource || !videoSource.src) {
    console.error("ezgif webp2mp4: could not find video source in second response");
    const errorMsg = document2.querySelector('.errorרישום')?.textContent || document2.querySelector('#output .warning')?.textContent;
    if(errorMsg) console.error("ezgif error (step 2):", errorMsg);
    throw new Error("Failed to process image with ezgif (step 2).");
  }
  return new URL(videoSource.src, res2.url).toString();
};

export const webp2png = async (source) => {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);
  form.append("new-image-url", isUrl ? source : "");
  if (!isUrl) {
    form.append("new-image", source, "image.webp"); // Assuming source is a Buffer or Stream
  }

  // Note: The URL s6.ezgif.com might be specific or temporary. General ezgif.com/webp-to-png might be more robust.
  // For now, using the provided URL.
  let res = await fetch("https://s6.ezgif.com/webp-to-png", { 
    method: "POST",
    body: form,
  });
  let html = await res.text();
  let { document } = new JSDOM(html).window;
  let form2 = new FormData();
  let obj = {};
  document.querySelectorAll("form input[name]").forEach(input => {
    obj[input.name] = input.value;
    form2.append(input.name, input.value);
  });

  if (!obj.file) {
      console.error("ezgif webp2png: could not find file input in first response");
      const errorMsg = document.querySelector('.errorרישום')?.textContent;
      if(errorMsg) console.error("ezgif error:", errorMsg);
      throw new Error("Failed to process image with ezgif for PNG conversion (step 1).");
  }
  
  // The action URL for the second POST might also vary or need to be constructed carefully
  let res2 = await fetch("https://s6.ezgif.com/webp-to-png/" + obj.file, { // Using s6 again
    method: "POST",
    body: form2,
  });
  let html2 = await res2.text();
  // console.log(html2); // For debugging ezgif responses
  let { document: document2 } = new JSDOM(html2).window;
  const imgElement = document2.querySelector("div#output > p.outfile > img");
  if (!imgElement || !imgElement.src) {
    console.error("ezgif webp2png: could not find image source in second response");
    const errorMsg = document2.querySelector('.errorרישום')?.textContent || document2.querySelector('#output .warning')?.textContent;
    if(errorMsg) console.error("ezgif error (step 2 png):", errorMsg);
    throw new Error("Failed to process image with ezgif for PNG conversion (step 2).");
  }
  return new URL(imgElement.src, res2.url).toString();
};

export const parseJid = (text = "") => {
  return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
    (v) => v[1] + "@s.whatsapp.net"
  );
};

export const parsedJid = (text = "") => { // Renamed to avoid conflict, original name implies it's already parsed
  return [...text.matchAll(/([0-9]{5,16}|0)/g)].map( // This regex is broader, might catch numbers not intended as JIDs
    (v) => v[1] + "@s.whatsapp.net"
  );
};

export const isIgUrl = (url) => {
  if (typeof url !== 'string') return false;
  return /(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am|instagr.com)\/(\w+)/gim.test(
    url
  );
};

// Corrected interpretation of isUrl and getUrl
export const isUrl = (url) => {
  if (typeof url !== 'string') return false;
  return new RegExp(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
    "gi"
  ).test(url);
};

export const getUrl = (url) => {
  if (typeof url !== 'string') return null;
  return url.match(
    new RegExp(
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
      "gi"
    )
  );
};

export const qrcode = async (string) => {
  const buff = await qrToBuffer(string);
  return buff;
};

export const secondsToDHMS = (seconds) => {
  seconds = Number(seconds);
  if (isNaN(seconds)) return "";

  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} Day${d > 1 ? 's' : ''}`);
  if (h > 0) parts.push(`${h} Hour${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} Minute${m > 1 ? 's' : ''}`);
  if (s > 0 || parts.length === 0) parts.push(`${s} Second${s > 1 ? 's' : ''}`); // Show seconds if it's the only unit or > 0
  
  return parts.join(" ");
};

export const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes || bytes < 0) return "0 Bytes"; // Handle zero or negative

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const sleep = delay; // delay is imported from baileys

export const clockString = (duration) => {
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  return hours + ":" + minutes + ":" + seconds;
};

export const runtime = () => { // Calculates uptime of the current process
  const duration = process.uptime(); // duration in seconds
  const seconds = Math.floor(duration % 60);
  const minutes = Math.floor((duration / 60) % 60);
  const hours = Math.floor((duration / (60 * 60)) % 24); // Uptime can exceed 24 hours
  const days = Math.floor(duration / (60 * 60 * 24));

  let formattedTime = "";
  if (days > 0) {
    formattedTime += `${days}d `;
  }
  formattedTime += `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return formattedTime;
};

export const validateQuality = (quality) => {
  let valid = ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p", "2160p", "4320p"]; // Added higher qualities
  return valid.includes(String(quality).toLowerCase()); // Ensure comparison is case-insensitive and works with numbers
};

export const AddMp3Meta = async (
  songbuffer,
  coverBuffer,
  options = {} // Default options should be more flexible or applied internally
) => {
  const defaultOptions = { title: "WAALT Whatsapp bot", artist: ["Xasena"], album: "Unknown Album", year: new Date().getFullYear().toString() };
  const finalOptions = { ...defaultOptions, ...options };


  if (!Buffer.isBuffer(songbuffer)) {
    songbuffer = await getBuffer(songbuffer).catch(e => { throw new Error(`Failed to get song buffer: ${e.message}`)});
  }
  if (coverBuffer && !Buffer.isBuffer(coverBuffer)) { // coverBuffer is optional
    coverBuffer = await getBuffer(coverBuffer).catch(e => { console.warn(`Failed to get cover buffer: ${e.message}`); return null; });
  }

  const writer = new id3(songbuffer);
  writer
    .setFrame("TIT2", finalOptions.title) // Title
    .setFrame("TPE1", Array.isArray(finalOptions.artist) ? finalOptions.artist : [String(finalOptions.artist)]) // Artist
    .setFrame("TALB", finalOptions.album) // Album
    .setFrame("TYER", String(finalOptions.year)); // Year
    
  if (coverBuffer) {
    writer.setFrame("APIC", {
      type: 3, // 3: Cover (front)
      data: coverBuffer,
      description: finalOptions.title || "Cover", // Description for the cover
      mime: (await fromBuffer(coverBuffer))?.mime || 'image/jpeg' // auto-detect mime or default
    });
  }
  
  writer.addTag();
  return Buffer.from(writer.arrayBuffer);
};

export const shortenWithBitly = async (urlToShorten) => { // Renamed parameter to avoid conflict
  return new Promise((resolve, reject) => {
    if (!config.BITLY_API_KEY) { // Assuming API key is in config
        return reject(new Error("Bitly API key is not configured."));
    }
    const bitly = new BitlyClient(config.BITLY_API_KEY); // Use API key from config
    bitly
      .shorten(urlToShorten)
      .then((a) => {
        resolve(a.link); // Typically, you want just the short link
      })
      .catch((A) => reject(A));
  });
};

// These functions use `this`. They are exported as regular functions.
// To use them, you'll need to set the context of `this`, e.g., `isNumber.call("123")`.
export function isNumber() {
  const int = parseInt(this);
  return typeof int === "number" && !isNaN(int);
}

export function getRandom() {
  if (Array.isArray(this) || typeof this === 'string' || this instanceof String) // Added check for primitive string
    return this[Math.floor(Math.random() * this.length)];
  if (typeof this === 'number' && Number.isFinite(this)) // For number, get random up to this number (exclusive)
    return Math.floor(Math.random() * this);
  return undefined; // Or throw an error for unsupported types
}

export { shortenWithBitly as Bitly };