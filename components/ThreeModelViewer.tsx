import { ThreeViewer } from './ThreeViewer';

type Props = {
  modelUrl: string;
};

export function ThreeModelViewer({ modelUrl }: Props) {
  return <ThreeViewer imageUrl={modelUrl} title="Property" />;
}
