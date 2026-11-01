import { useEffect, useState } from "react";
import { Button, Modal } from "./ui";
type Prompt = { message: string; resolve: (answer: boolean) => void };
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent<Prompt>("mayday:confirm", {
        detail: { message, resolve },
      }),
    ),
  );
}
export function ConfirmHost() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  useEffect(() => {
    const listener = (event: Event) =>
      setPrompt((old) => {
        old?.resolve(false);
        return (event as CustomEvent<Prompt>).detail;
      });
    window.addEventListener("mayday:confirm", listener);
    return () => window.removeEventListener("mayday:confirm", listener);
  }, []);
  function answer(value: boolean) {
    prompt?.resolve(value);
    setPrompt(null);
  }
  return prompt ? (
    <Modal title="Xác nhận thao tác" onClose={() => answer(false)}>
      <div className="modal-body">
        <p>{prompt.message}</p>
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={() => answer(false)}>
          Hủy
        </Button>
        <Button onClick={() => answer(true)}>Xác nhận</Button>
      </div>
    </Modal>
  ) : null;
}
