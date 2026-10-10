import type { AudiovisualScene } from '../../../types/videoStudio';
import { ConceptIllustrationGraphic } from './ConceptIllustrationGraphic';

interface Props {
  scene: AudiovisualScene;
}

export const SceneGraphicRenderer = ({ scene }: Props) => {
  return <ConceptIllustrationGraphic scene={scene} />;
};
