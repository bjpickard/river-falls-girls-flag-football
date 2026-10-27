export default function (eleventyConfig) {
  eleventyConfig.addFilter("youtubeThumbnail", (value = "") => {
    try {
      const url = new URL(value);
      let id = "";
      if (url.hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
      if (url.hostname.includes("youtube.com")) {
        id = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
      }
      return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
    } catch {
      return "";
    }
  });

  eleventyConfig.addFilter("documentThumbnail", (value = "") => {
    try {
      const url = new URL(value);
      if (!url.hostname.includes("google.com")) return "";

      const pathMatch = url.pathname.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([^/]+)/);
      const id = pathMatch?.[1] || url.searchParams.get("id") || "";
      return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800` : "";
    } catch {
      return "";
    }
  });

  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "dist"
    },
    htmlTemplateEngine: "njk"
  };
}
