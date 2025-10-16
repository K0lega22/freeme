import AICommandBar from "../AICommandBar";

export default function AICommandBarExample() {
  return (
    <AICommandBar
      onSubmit={(command) => console.log("AI Command:", command)}
    />
  );
}
