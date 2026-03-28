import type { ReactElement } from "react";
import { SECTION_GROUPS, SECTIONS, type SectionKey } from "../constants";
import { styles } from "../styles";

interface OverviewProps {
	visibleSectionKeys: ReadonlySet<SectionKey>
}

function Overview({ visibleSectionKeys }: OverviewProps): ReactElement {
	const visibleSections = SECTIONS.filter((section) => visibleSectionKeys.has(section.key));
	const visibleGroups = SECTION_GROUPS.map((group) => ({
		label: group.label,
		sections: group.items
			.map((sectionKey) => visibleSections.find(({ key }) => key === sectionKey))
			.filter((section): section is (typeof SECTIONS)[number] => Boolean(section)),
	})).filter((group) => group.sections.length > 0);

  return (
    <section style={styles.formSection}>
      <div style={styles.proseContent}>
        <h2>Hufak account configuration</h2>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <h3 style={styles.subheading}>{group.label}</h3>
            <ul style={styles.overviewList}>
              {group.sections.map((section) => (
                <li key={section.key}>
                  <strong>{section.label}</strong>: {section.description}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export { Overview };
