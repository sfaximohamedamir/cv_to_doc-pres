import re

f = open(r'src/lib/converters/word-converter.ts', 'r')
c = f.read()
f.close()

old = "import { getTemplate, type CvTemplate, type CvTemplateId } from '@/lib/cv/templates'"
new = old + "\nimport type { ExtractedTemplateStyle } from './template-analyzer'"
c = c.replace(old, new)

# Modify generateWordCv signature and logic
old_sig = """export async function generateWordCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
}): Promise<Buffer> {"""
new_sig = """export async function generateWordCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
  templateStyle?: ExtractedTemplateStyle
}): Promise<Buffer> {"""
c = c.replace(old_sig, new_sig)

old_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  ACCENT_COLOR = template.accentColor.toLowerCase()
  SECONDARY_COLOR = template.secondaryColor.toLowerCase()
  HEADER_BG = template.headerBg.toLowerCase()
  LINK_COLOR = template.accentColor.toLowerCase()
  ACCENT_TEXT_COLOR = template.accentTextColor.toUpperCase()
  SECTION_HAS_BORDER = template.sectionBorder
  COLORED_HEADER = template.coloredHeader"""
new_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  const tStyle = params.templateStyle
  if (tStyle && tStyle.valid) {
    ACCENT_COLOR = (tStyle.accentColor || template.accentColor).toLowerCase()
    SECONDARY_COLOR = (tStyle.secondaryColor || template.secondaryColor).toLowerCase()
    HEADER_BG = (tStyle.headerBg || template.headerBg).toLowerCase()
    LINK_COLOR = (tStyle.accentColor || template.accentColor).toLowerCase()
    ACCENT_TEXT_COLOR = (tStyle.accentTextColor || template.accentTextColor).toUpperCase()
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  } else {
    ACCENT_COLOR = template.accentColor.toLowerCase()
    SECONDARY_COLOR = template.secondaryColor.toLowerCase()
    HEADER_BG = template.headerBg.toLowerCase()
    LINK_COLOR = template.accentColor.toLowerCase()
    ACCENT_TEXT_COLOR = template.accentTextColor.toUpperCase()
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  }"""
c = c.replace(old_logic, new_logic)

f = open(r'src/lib/converters/word-converter.ts', 'w')
f.write(c)
f.close()
print('word-converter.ts updated')
