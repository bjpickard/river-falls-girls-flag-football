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
