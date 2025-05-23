import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }) {
  return (
    <>
      <Header />

      <main className="container">
        <section style={{ marginTop: "2rem", marginBottom: "2rem" }}>
          {children}
        </section>
      </main>

      <Footer />
    </>
  );
}
    