import ReviewPage from "@/components/ReviewPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fileId: string }>;
}) {
  const { id, fileId } = await params;
  return <ReviewPage projectId={id} fileId={fileId} />;
}
