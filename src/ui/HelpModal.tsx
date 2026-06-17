import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => (
  <div className="modal-overlay" role="dialog" aria-modal onClick={onClose}>
    <div className="modal" onClick={(event) => event.stopPropagation()}>
      <header className="modal-header">
        <h2>Building a patient selection diagram</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="modal-body">
        <section>
          <h3>Get started fast</h3>
          <ul>
            <li>
              Pick a <strong>template</strong> on the left (STROBE selection, CONSORT trial, case-control, PRISMA) and edit
              the text and counts.
            </li>
            <li>
              Apply a <strong>journal style preset</strong> to match Helvetica/Arial house styles and sharp black-and-white
              formatting.
            </li>
          </ul>
        </section>
        <section>
          <h3>Edit the flow</h3>
          <ul>
            <li>Select a box, then use the <strong>+</strong> button beneath it to add a step or <strong>⎇</strong> to branch.</li>
            <li>Click a connector to add an <strong>exclusion</strong> box with reasons; the remainder is filled in automatically.</li>
            <li>
              Counts stay balanced in <em>auto</em> mode. Switch to <em>manual</em> or <em>free edit</em> to override; mismatches
              show a red Δ (never exported).
            </li>
          </ul>
        </section>
        <section>
          <h3>Resize &amp; reshape</h3>
          <ul>
            <li>Open the <strong>Format</strong> tab to change font, box width, spacing, line weight, corners, and number style.</li>
            <li><strong>Drag</strong> any box to fine-tune its position; “Reset manual positioning” snaps everything back.</li>
            <li>Scroll to zoom, drag the background to pan, and use <strong>Fit</strong> to recentre.</li>
          </ul>
        </section>
        <section>
          <h3>Export for publication</h3>
          <ul>
            <li>Set the <strong>figure width</strong> (88 / 130 / 180 mm) in the Format tab, then export.</li>
            <li><strong>SVG</strong> is true vector (open in Illustrator/Inkscape for EPS/PDF). <strong>PNG 600–1000 dpi</strong> suits line-art requirements; <strong>JPG</strong> and <strong>Print</strong> are also available.</li>
          </ul>
        </section>
        <section>
          <h3>Keyboard</h3>
          <ul className="shortcut-list">
            <li><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> move selection</li>
            <li><kbd>Cmd/Ctrl</kbd>+<kbd>↓</kbd> add step</li>
            <li><kbd>Cmd/Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Shift</kbd>+<kbd>Cmd/Ctrl</kbd>+<kbd>Z</kbd> redo</li>
            <li><kbd>Delete</kbd> remove box · <kbd>Esc</kbd> deselect</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
);
