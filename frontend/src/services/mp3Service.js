// src/services/mp3Service.js
export async function cutMp3(file, start, end) {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("start", start);
  formData.append("end", end);

  const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/cut-mp3`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Lỗi khi gọi API cut MP3");
  }

  return res.json();
}
