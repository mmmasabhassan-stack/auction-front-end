import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 24,
          background: "var(--surface-0, #fff)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          IIAP Lost &amp; Found Auction System
        </h1>
        <p style={{ marginTop: 10, color: "var(--text-light, #666)" }}>
          Choose a portal to continue:
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link
            href="/admin"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #1a5f3f 0%, #2d8659 100%)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Admin
          </Link>
          <Link
            href="/sub-admin"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d3e26 0%, #1a5f3f 100%)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Sub-Admin
          </Link>
          <Link
            href="/user"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #17a2b8 0%, #1976d2 100%)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            User
          </Link>
        </div>

        <p style={{ marginTop: 18, fontSize: 12, color: "var(--text-light, #666)" }}>
          If API routes fail, create <code>.env.local</code> from <code>env.local.example</code> and
          restart the dev server.
        </p>
      </div>
    </main>
  );
}

