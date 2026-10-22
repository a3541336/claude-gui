export function ThinkingBlock({ text }: { text: string }) {
  return (
    <details className="entry entry--thinking">
      <summary>思考過程</summary>
      <pre>{text}</pre>
    </details>
  );
}
