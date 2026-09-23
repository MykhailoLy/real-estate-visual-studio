import Link from "next/link";
import ArticleBeforeAfter from "./ArticleBeforeAfter";
import {
  sectionHeadingClass,
  subsectionHeadingClass,
  ExternalArticleLink,
  InternalArticleLink,
  ResponsiveTable,
} from "./ArticleElements";

export default function OutsourceRealEstatePhotoEditingArticle() {
  return (
    <>
      <p>
        Before you outsource real estate photo editing, try a small order using the kinds of photos
        you shoot every week. Send clear instructions and a style reference. Then check the results
        together and track how much time you spend reviewing them.
      </p>

      <p>
        The goal is not just brighter photos. You need a set that matches your style, shows the
        property accurately, and leaves you with less work. Here is a practical way to test that
        before you commit to regular orders.
      </p>

      <h2 id="agree-on-what-you-are-sending-and-buying" className={sectionHeadingClass}>
        1. Agree on what you are sending and buying
      </h2>

      <p>
        Are you sending files straight from the camera, or prepared JPGs that need a final edit?
        Will you choose the photos, or do you expect the editor to select them?
      </p>

      <p>
        Explain how you shoot. You might use one exposure per view, bracketed shots of the same
        scene at different exposures, or a mix of flash and ambient shots.
        {" "}
        <ExternalArticleLink href="https://helpx.adobe.com/lightroom/desktop/edit-photos/hdr-panorama.html">
          HDR photo merging
        </ExternalArticleLink>
        {" "}
        combines bracketed shots into one image. It is a different task from adjusting the color
        and brightness of an existing JPG.
      </p>

      <p>
        Confirm the file types the editor accepts, how to group related shots, and the format you
        will get back. Also agree on what the price covers. Does one charge cover a finished photo
        or each source frame? Are window edits, sky changes, and object removal included or extra?
      </p>

      <p>
        For regular work, start with a small paid test or a trial with clear terms. Check what a
        trial covers before using it to judge the full service.
      </p>

      <h2 id="choose-photos-that-reflect-your-usual-work" className={sectionHeadingClass}>
        2. Choose photos that reflect your usual work
      </h2>

      <p>
        Do not send only your easiest living room. But do not build a test from rare problems you
        almost never face, either.
      </p>

      <p>
        For a mix of interior and exterior work, try these six views. Use fewer or different shots
        when that better fits your work.
      </p>

      <ResponsiveTable label="Photos to include in an editing test">
        <thead className="bg-primary text-white">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Photos to include</th>
            <th scope="col" className="px-4 py-3 font-bold">What to check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white align-top">
          <tr>
            <td className="px-4 py-3">Two views of the same room</td>
            <td className="px-4 py-3">Do the same walls, floors, and cabinets keep a consistent color?</td>
          </tr>
          <tr>
            <td className="px-4 py-3">An interior with a bright window</td>
            <td className="px-4 py-3">Is the room well lit, with a believable view and clean window edges?</td>
          </tr>
          <tr>
            <td className="px-4 py-3">A room with mixed lighting</td>
            <td className="px-4 py-3">Are unwanted color casts reduced without changing the materials?</td>
          </tr>
          <tr>
            <td className="px-4 py-3">A dark room or corner</td>
            <td className="px-4 py-3">Are shadows lifted without making the photo look flat or washed out?</td>
          </tr>
          <tr>
            <td className="px-4 py-3">An exterior</td>
            <td className="px-4 py-3">Do the light, colors, and edges match your usual style?</td>
          </tr>
        </tbody>
      </ResponsiveTable>

      <p>
        Use the files you would send for a normal job. Point out missing exposures, soft images, or
        other known problems. When comparing editors, send the same files and brief, and note any
        differences in the work they agree to do.
      </p>

      <p>
        For an initial style check, see PicchuSpot&apos;s
        {" "}
        <InternalArticleLink href="/pricing/photo-editing">
          photo editing examples and options
        </InternalArticleLink>
        . The Brightness &amp; Contrast Lift pair is one place to start: compare shadows, bright
        areas, and edges, not just overall brightness. A portfolio helps you assess style; your own
        test checks the fit for your work.
      </p>

      <ArticleBeforeAfter
        label="Brightness and contrast: exterior before and after editing"
        before={{
          src: "/images/blog/photo-editing-brightness-contrast-before.webp",
          alt: "Row houses and front gardens before editing, with deep shadows beneath the windows",
          width: 1920,
          height: 1277,
        }}
        after={{
          src: "/images/blog/photo-editing-brightness-contrast-after.webp",
          alt: "Row houses and front gardens after brightness and contrast editing",
          width: 1920,
          height: 1281,
        }}
        caption="Compare the brightness and shadows around the doors and planting. Inspect roof and window edges, color consistency in the wood and greenery, and whether the result keeps a natural appearance."
      />

      <h2 id="give-the-editor-a-clear-brief" className={sectionHeadingClass}>
        3. Give the editor a clear brief
      </h2>

      <p>
        “Bright and natural” can mean different things to different people. Add a reference image
        and say what you like about it. Is it the warm wood, soft contrast, neutral walls, or
        treatment of the windows?
      </p>

      <p>
        Use your own work or images you have permission to share. Adapt this brief to the job:
      </p>

      <blockquote className="space-y-4 border-l-4 border-secondary bg-surface p-5 sm:p-6">
        <p>
          <strong>Style:</strong>
          {" "}
          Match the references for brightness, contrast, and color. Keep the room&apos;s real shape
          and material colors.
        </p>
        <p>
          <strong>Light:</strong>
          {" "}
          Keep interiors bright without washing them out. Preserve warm wood tones. Do not turn cream
          walls white.
        </p>
        <p>
          <strong>Windows:</strong>
          {" "}
          Use the view recorded in the source files. Keep it natural beside the room, rather than
          much darker or sharper. Do not invent a different view.
        </p>
        <p>
          <strong>Changes:</strong>
          {" "}
          Apply only the agreed edits. Ask before removing objects or changing property features.
          Flag missing detail rather than guessing.
        </p>
        <p>
          <strong>Files and deadline:</strong>
          {" "}
          Deliver [number] finished photos in [format and size]. Use [filenames] and send them by
          [date, time, and time zone].
        </p>
      </blockquote>

      <p>
        Fill in the brackets and add notes for specific images. For object removal, name the file
        and mark the exact item. A general request to “clean up the room” leaves too much open to
        interpretation.
      </p>

      <h2 id="review-the-results-in-three-passes" className={sectionHeadingClass}>
        4. Review the results in three passes
      </h2>

      <h3 id="compare-the-full-set" className={subsectionHeadingClass}>
        Compare the full set
      </h3>

      <p>
        View the photos together at the same size. Do they follow your references? Do two angles of
        the same room look like they belong in one listing?
      </p>

      <p>
        Consistent editing does not mean making every room equally bright. Look for changes that
        the lighting does not explain. A cabinet should not look gray in one view and strongly
        yellow in the next.
      </p>

      <h3 id="inspect-individual-photos" className={subsectionHeadingClass}>
        Inspect individual photos
      </h3>

      <p>
        Compare each edited image with its source at full resolution. Check windows, door frames,
        ceiling lines, reflections, fine textures, and any areas where objects were removed.
      </p>

      <p>
        Use this checklist to make your feedback specific:
      </p>

      <ResponsiveTable label="Photo editing quality checklist">
        <thead className="bg-primary text-white">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Check</th>
            <th scope="col" className="px-4 py-3 font-bold">What may need a correction</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white align-top">
          <tr>
            <td className="px-4 py-3">Color and style</td>
            <td className="px-4 py-3">Unwanted color casts, changed finishes, or a result that misses the reference</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Light and detail</td>
            <td className="px-4 py-3">Washed-out areas, an overly processed look, or lost detail that was present in the source</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Windows and edges</td>
            <td className="px-4 py-3">Bright halos, dark outlines, doubled edges, or a different exterior view</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Shape and content</td>
            <td className="px-4 py-3">Warped rooms, stretched features, or objects changed without approval</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Export</td>
            <td className="px-4 py-3">Missing photos, wrong file sizes, unclear names, or files that will not open</td>
          </tr>
        </tbody>
      </ResponsiveTable>

      <ArticleBeforeAfter
        label="Interior and window view: before and after editing"
        before={{
          src: "/images/blog/photo-editing-window-view-before.webp",
          alt: "Living room before editing, with a dark sofa and a bright window view",
          width: 1920,
          height: 1279,
        }}
        after={{
          src: "/images/blog/photo-editing-window-view-after.webp",
          alt: "Living room after editing, with a brighter sofa and clearer buildings through the window",
          width: 1920,
          height: 1279,
        }}
        caption="Compare room brightness, shadows beneath the sofa, and edges around the window frames. Check color consistency in the walls and floor, and whether the room and window view look natural together."
      />

      <h3 id="check-the-delivery" className={subsectionHeadingClass}>
        Check the delivery
      </h3>

      <p>
        Are the files ready for your next step? Check the deadline, naming, and export settings.
        Note any extra work you had to do before sending the photos to your client.
      </p>

      <p>
        A missed instruction needs a correction. A new style request is a change to the brief.
        Missing detail in the source is a separate problem.
      </p>

      <h2 id="know-what-the-source-files-can-support" className={sectionHeadingClass}>
        5. Know what the source files can support
      </h2>

      <p>
        A bright window in a preview does not always mean the view is lost. Check the original
        files first. Some highlight detail may still be recoverable, especially in RAW files; fully
        clipped areas contain no usable detail. Adobe explains this distinction in its
        {" "}
        <ExternalArticleLink href="https://helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/image-tone-color.html">
          guide to image tone and color
        </ExternalArticleLink>
        .
      </p>

      <p>
        If none of the files contains the actual view, inventing scenery is not the same as
        recovering it. Ask the editor to flag the problem. You may need another genuine source
        image, a different approach to the edit, or a reshoot.
      </p>

      <p>
        Before changing or removing property features, ask the listing agent to check the relevant
        MLS rules. CRMLS, for example, has its own
        {" "}
        <ExternalArticleLink href="https://kb.crmls.org/knowledgebase/digitally-altered-image-guidance-faqs/">
          guidance on digitally altered images
        </ExternalArticleLink>
        . Its requirements should not be treated as rules for every MLS or market.
      </p>

      <h2 id="make-revision-requests-specific" className={sectionHeadingClass}>
        6. Make revision requests specific
      </h2>

      <p>
        When the result needs a correction, send one clear request with the filename, area to fix,
        and parts to keep.
      </p>

      <p>
        For example:
      </p>

      <blockquote className="space-y-4 border-l-4 border-secondary bg-surface p-5 sm:p-6">
        <p>
          “In image 04, the ceiling looks green compared with the reference. Please correct the
          ceiling color. Keep the warm cabinets and current window brightness.”
        </p>
      </blockquote>

      <p>
        After the update, check both the requested change and the areas that were already right.
        Record how much time you spent explaining and reviewing the fix.
      </p>

      <p>
        When the first delivery meets the brief, there is no need to invent a problem to test the
        editor. Confirm the revision terms for future work and move on.
      </p>

      <h2 id="count-the-time-you-actually-save" className={sectionHeadingClass}>
        7. Count the time you actually save
      </h2>

      <p>
        A low price is not much help when you have to redo the work. Compare the same job with and
        without outsourcing, including the time you spend sending files, checking results, and
        handling revisions.
      </p>

      <p>
        <strong>
          Time saved = time you would spend editing and checking − time you still spend after
          outsourcing.
        </strong>
      </p>

      <p>
        Here is a made-up example, not a PicchuSpot quote or an industry average. A 30-photo job
        takes you 120 minutes to edit and check yourself. After outsourcing, you spend 10 minutes
        sending files, 20 minutes checking results, and 15 minutes on corrections. That is 45
        minutes of your own work, leaving you with 75 minutes saved.
      </p>

      <p>
        If the editing bill is $45, you have paid $36 for each hour saved: $45 divided by 1.25
        hours. Whether that is worthwhile depends on how you use the time. An extra shoot may bring
        in revenue when there is demand; more rest may also be worth the cost. Saved time is not
        automatically extra income.
      </p>

      <p>
        If you save no time, find out why. The brief may be unclear, the sources incomplete, or the
        editor a poor fit.
      </p>

      <h2 id="try-a-full-listing-before-scaling-up" className={sectionHeadingClass}>
        8. Try a full listing before scaling up
      </h2>

      <p>
        A good sample is a reason to try one normal listing, not hand over every job at once. Check
        the full set, including routine shots that would never appear in a portfolio.
      </p>

      <p>
        Before starting regular orders, agree on prices, deadlines, time zones, file formats, and
        revision terms. Also discuss file privacy, storage and deletion, permission to use images
        in a portfolio, and contact with your clients.
      </p>

      <p>
        Keep the approved brief and references in one place. Update them when your needs change.
      </p>

      <h2 id="start-a-photo-editing-order-with-picchuspot" className={sectionHeadingClass}>
        Start a photo editing order with PicchuSpot
      </h2>

      <p>
        Use the same checklist when you try PicchuSpot. Review the examples and pricing, choose the
        edits you need, and send a reference image with your notes.
      </p>

      <p>
        <Link
          href="/pricing/photo-editing"
          className="inline-flex rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary-light focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          See Photo Editing Examples &amp; Pricing
        </Link>
      </p>

      <p>
        You can upload JPG or PNG files through the website. For RAW files or bracketed sets,
        {" "}
        <InternalArticleLink href="/contact">
          contact PicchuSpot
        </InternalArticleLink>
        {" "}
        to agree on the work and share a link to your own cloud folder. Include a note about how
        you shoot and the number of finished photos you need.
      </p>
    </>
  );
}
