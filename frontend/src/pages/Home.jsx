import React from "react";
import Layout from "../components/Layout";

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
      path: "#",
      emoji: "🖼️",
    },
    {
      name: "Chuyển đổi video",
      description: "Chuyển đổi video sang định dạng MP4, AVI, WebM...",
      path: "#",
      emoji: "🎞️",
    },
  ];

  return (

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

  );
}
