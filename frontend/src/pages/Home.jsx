import React from "react";
import Layout from "../shared/components/Layout";

export default function Home() {
  const tools = [
    {
      name: "Cắt MP3",
      description: "Tải lên file MP3 và cắt đoạn mong muốn.",
      path: "/mp3-cutter",
      emoji: "✂️",
    },
    {
      name: "Nén ảnh",
      description: "Giảm dung lượng ảnh JPG/PNG một cách nhanh chóng.",
      path: "/image-compressor",
      emoji: "🖼️",
    },
    {
      name: "Tải YouTube",
      description: "Tải video và audio từ YouTube về máy.",
      path: "/youtube-downloader",
      emoji: "📺",
    },
  ];

  return (
    <Layout>
      <section className="container">
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>
          ✨ Chào mừng đến với All-in-One Tools
        </h2>

        <div className="grid">
          {tools.map((tool, index) => (
            <article key={index}>
              <h3>{tool.emoji} {tool.name}</h3>
              <p>{tool.description}</p>
              <a href={tool.path} role="button">Bắt đầu</a>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
