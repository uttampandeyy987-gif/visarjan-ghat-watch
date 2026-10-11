import styles from "./ErrorPanel.module.css";

export default function ErrorPanel({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.wrap}>
      <div className={styles.panel} role="alert">
        <p className={styles.kicker}>Ghat Watch</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </main>
  );
}
