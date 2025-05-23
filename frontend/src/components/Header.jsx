import React from "react";

export default function Header() {
  return (
    <header className="container" style={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "1rem" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "0.2rem" }}>🧰 <a href="/">All-in-One Tools</a></h1>
      <p style={{ fontSize: "1.1rem", color: "#666" }}>
        Chỉnh sửa tệp nhanh chóng – miễn phí – không quảng cáo
      </p>
    </header>
  );
}
