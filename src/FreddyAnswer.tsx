import { useId, useState } from "react";

export default function FreddyAnswer({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = content.length > 650;
  const boundary = long ? content.lastIndexOf(" ", 650) : content.length;
  const preview = content.slice(0, boundary > 350 ? boundary : 650).trimEnd();
  return (
    <>
      <div className="campus-ai-answer" id={id}>
        {long && !expanded ? `${preview} …` : content}
      </div>
      {long && (
        <button
          className="campus-ai-read-more"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Antwort einklappen" : "Vollständige Antwort lesen"}
        </button>
      )}
    </>
  );
}
