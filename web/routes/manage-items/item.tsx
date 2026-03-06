import { useParams } from "react-router";

export default function ItemPage() {
  const { item } = useParams();
  return <div>Item: {item}</div>;
}
