import axios from "axios";
import ytsearch from "@neeraj-x0/ytsearch";

const search = async (query, limit = 1) => {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const filters = await ytsearch.getFilters(searchUrl); // Pass the full search URL
  const filter = filters.get("Type")?.get("Video"); // Add optional chaining
  if (!filter || !filter.url) {
    // Fallback or error if 'Video' filter is not found
    console.warn("Video filter not found for query:", query, "Attempting search without specific filter.");
    const searchResultsDirect = await ytsearch(query, { limit });
     return searchResultsDirect.items.map(
      ({ title, url, author, views, duration, uploadedAt }) => {
        return { title, url, author: author?.name, views, duration, uploadedAt }; // Handle author possibly being an object
      }
    );
  }

  const options = {
    limit,
  };
  const searchResults = await ytsearch(filter.url, options);
  return searchResults.items.map(
    ({ title, url, author, views, duration, uploadedAt }) => {
      return { title, url, author: author?.name, views, duration, uploadedAt };
    }
  );
};


const ytdlget = async (url) => {
  return new Promise((resolve, reject) => {
    let qu = "query=" + encodeURIComponent(url);

    let axiosConfig = { // Renamed to avoid conflict
      method: "post",
      maxBodyLength: Infinity,
      url: "https://tomp3.cc/api/ajax/search",
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data: qu,
    };

    axios
      .request(axiosConfig)
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

/**
 *
 * @param {object} data The data object from ytdlget
 * @param {object} options Contains type and quality
 * @returns {Array}
 */
function formatYtdata(data, options) {
  const { type, quality } = options;
  const formatted_data = [];

  const processFormat = (format) => {
    if (format && format.k) { // Ensure format and format.k exist
      const info = {
        vid: data.vid,
        id: format.k,
        size: format.size,
        quality: format.q,
        type: format.f,
      };
      formatted_data.push(info);
    }
  };
  
  if (data.links) {
      if (data.links.mp4) {
        Object.values(data.links.mp4).forEach(processFormat);
      }
      if (data.links.mp3 && data.links.mp3.mp3128) {
         processFormat(data.links.mp3.mp3128);
      }
      if (data.links["3gp"] && data.links["3gp"]["3gp@144p"]) {
         processFormat(data.links["3gp"]["3gp@144p"]);
      }
  }


  let filtered = formatted_data;
  if (type) {
    filtered = filtered.filter((format) => format.type === type);
  }
  if (quality) {
    // Match quality flexibly, e.g., "480p" should match "480p"
    filtered = filtered.filter((format) => format.quality && format.quality.includes(quality.replace('p','')));
  }
  return filtered;
}

async function ytdlDl(vid, k) {
  const dataPayload = `vid=${vid}&k=${encodeURIComponent(k)}`; // Renamed variable

  const axiosConfig = { // Renamed variable
    method: "post",
    maxBodyLength: Infinity,
    url: "https://tomp3.cc/api/ajax/convert",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9,en-IN;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    data: dataPayload,
  };

  try {
    const response = await axios.request(axiosConfig);
    return response.data;
  } catch (error) {
    console.error("Error in ytdlDl:", error);
    throw new Error("An error occurred during the ytdlDl request");
  }
}

async function yta(url) {
  const data = await ytdlget(url);
  if (!data || !data.vid) throw new Error("Failed to get YouTube data for audio.");
  
  const formatted_data = formatYtdata(data, {
    type: "mp3",
  });
  if (!formatted_data || formatted_data.length === 0) throw new Error ("No MP3 format found.");

  const k = formatted_data[0].id;
  const vid = formatted_data[0].vid;
  let response = await ytdlDl(vid, k);

  response = {
    ...response,
    sizes: formatted_data[0].size,
    thumb: `https://i.ytimg.com/vi/${vid}/0.jpg`,
  };
  return response;
}

async function ytv(url, quality = "480p") {
  const data = await ytdlget(url);
  if (!data || !data.vid) throw new Error("Failed to get YouTube data for video.");

  let formatted_data = formatYtdata(data, { type: "mp4", quality });
  if (!formatted_data || formatted_data.length === 0) {
    // Fallback to any available mp4 if specific quality not found
    formatted_data = formatYtdata(data, {type: "mp4"});
    if (!formatted_data || formatted_data.length === 0) {
        throw new Error (`No MP4 format found for quality ${quality} or any fallback.`);
    }
    console.warn(`Quality ${quality} not found, falling back to ${formatted_data[0].quality}`);
  }


  const k = formatted_data[0].id;
  const vid = formatted_data[0].vid;
  let response = await ytdlDl(vid, k);
  response = {
    ...response,
    sizes: formatted_data[0].size,
    thumb: `https://i.ytimg.com/vi/${vid}/0.jpg`,
    quality: formatted_data[0].quality, // Add actual quality to response
  };
  return response;
}

const ytsdl = async (query, type = "audio") => {
  const searchResults = await search(query, 1); // Ensure search returns at least one item
  if (!searchResults || searchResults.length === 0) {
    throw new Error(`No search results found for query: ${query}`);
  }
  const url = searchResults[0].url;
  if (type === "audio") {
    return await yta(url);
  } else if (type === "video") {
    return await ytv(url); // Default quality will be used if not specified
  } else {
    throw new Error("Invalid type. Use 'audio' or 'video'");
  }
};

export { yta, ytv, ytdlDl, ytdlget, formatYtdata, ytsdl, search as ytSearch }; // Export search as ytSearch