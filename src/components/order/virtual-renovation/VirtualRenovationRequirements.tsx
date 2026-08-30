import OrderGuideRail, {
  type OrderGuideStep,
} from "@/components/order/OrderGuideRail";

const VIRTUAL_RENOVATION_GUIDE_STEPS: OrderGuideStep[] = [
  {
    title: "Upload",
    description:
      "Upload a high-resolution original image for each space you want to renovate.",
  },
  {
    title: "Describe",
    description:
      "Choose the renovation work and provide a clear style or design brief for the result you want.",
  },
  {
    title: "Review",
    description:
      "Review every image, selection and estimated total before submitting.",
  },
];

/** Virtual Renovation content composed through the shared responsive guide. */
export default function VirtualRenovationRequirements() {
  return (
    <OrderGuideRail
      title="Virtual Renovation guide"
      steps={VIRTUAL_RENOVATION_GUIDE_STEPS}
      informationTitle="What we need"
      information={
        <>
          <p>
            Use Virtual Renovation to visualise proposed changes to finishes,
            fixtures, layouts and selected architectural elements.
          </p>
          <p>
            Provide a clear style/design brief covering build changes, fixture
            changes, furniture, materials, textures and colour direction where
            relevant.
          </p>
          <p>
            Reference images, links or mark-up sketches are optional and useful
            when they clarify your direction. If you need inspiration, add
            example images or a reference link that shows what you want.
          </p>
          <p>
            Complex reconstruction or unclear source material may require
            custom review before work begins.
          </p>
          <dl className="space-y-2 border-t border-border pt-4">
            <div>
              <dt className="font-semibold text-foreground">Original photo</dt>
              <dd>JPG, JPEG or PNG.</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">
                Reference files
              </dt>
              <dd>JPG, JPEG, PNG, WebP or PDF.</dd>
            </div>
          </dl>
        </>
      }
    />
  );
}
