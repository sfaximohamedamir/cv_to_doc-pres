import re

f = open(r'src/lib/converters/powerpoint-converter.ts', 'r', encoding='utf-8')
c = f.read()
f.close()

# Add import for ExtractedTemplateStyle
old_import = "import { getTemplate, type CvTemplate, type CvTemplateId } from '@/lib/cv/templates'"
if old_import in c and 'ExtractedTemplateStyle' not in c:
    c = c.replace(old_import, old_import + "\nimport type { ExtractedTemplateStyle } from './template-analyzer'")

# Modify generatePowerPointCv signature
old_sig = """export async function generatePowerPointCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
}): Promise<Buffer> {"""
new_sig = """export async function generatePowerPointCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
  templateStyle?: ExtractedTemplateStyle
}): Promise<Buffer> {"""
c = c.replace(old_sig, new_sig)

# Modify the template style application logic
old_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  ACCENT_COLOR = template.accentColor.toUpperCase()
  SECONDARY_COLOR = template.secondaryColor.toUpperCase()
  ACCENT_LIGHT = template.headerBg.toUpperCase()
  DARK_BG = template.coloredHeader ? template.accentColor.toUpperCase() : '1F2937'
  SECTION_HAS_BORDER = template.sectionBorder
  COLORED_HEADER = template.coloredHeader"""
new_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  const tStyle = params.templateStyle
  if (tStyle && tStyle.valid) {
    ACCENT_COLOR = (tStyle.accentColor || template.accentColor).toUpperCase()
    SECONDARY_COLOR = (tStyle.secondaryColor || template.secondaryColor).toUpperCase()
    ACCENT_LIGHT = (tStyle.headerBg || template.headerBg).toUpperCase()
    DARK_BG = template.coloredHeader ? (tStyle.accentColor || template.accentColor).toUpperCase() : '1F2937'
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  } else {
    ACCENT_COLOR = template.accentColor.toUpperCase()
    SECONDARY_COLOR = template.secondaryColor.toUpperCase()
    ACCENT_LIGHT = template.headerBg.toUpperCase()
    DARK_BG = template.coloredHeader ? template.accentColor.toUpperCase() : '1F2937'
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  }"""
c = c.replace(old_logic, new_logic)

f = open(r'src/lib/converters/powerpoint-converter.ts', 'w', encoding='utf-8')
f.write(c)
f.close()
print('powerpoint-converter.ts updated')
c = f.read()
f.close()

# Add import for ExtractedTemplateStyle
old_import = "import { getTemplate, type CvTemplate, type CvTemplateId } from '@/lib/cv/templates'"
if old_import in c and 'ExtractedTemplateStyle' not in c:
    c = c.replace(old_import, old_import + "\nimport type { ExtractedTemplateStyle } from './template-analyzer'")

# Modify generatePowerPointCv signature
old_sig = """export async function generatePowerPointCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
}): Promise<Buffer> {"""
new_sig = """export async function generatePowerPointCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
  templateStyle?: ExtractedTemplateStyle
}): Promise<Buffer> {"""
c = c.replace(old_sig, new_sig)

# Modify the template style application logic
old_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  ACCENT_COLOR = template.accentColor.toUpperCase()
  SECONDARY_COLOR = template.secondaryColor.toUpperCase()
  ACCENT_LIGHT = template.headerBg.toUpperCase()
  DARK_BG = template.coloredHeader ? template.accentColor.toUpperCase() : '1F2937'
  SECTION_HAS_BORDER = template.sectionBorder
  COLORED_HEADER = template.coloredHeader"""
new_logic = """  const template: CvTemplate = getTemplate(params.templateId)
  const tStyle = params.templateStyle
  if (tStyle && tStyle.valid) {
    ACCENT_COLOR = (tStyle.accentColor || template.accentColor).toUpperCase()
    SECONDARY_COLOR = (tStyle.secondaryColor || template.secondaryColor).toUpperCase()
    ACCENT_LIGHT = (tStyle.headerBg || template.headerBg).toUpperCase()
    DARK_BG = template.coloredHeader ? (tStyle.accentColor || template.accentColor).toUpperCase() : '1F2937'
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  } else {
    ACCENT_COLOR = template.accentColor.toUpperCase()
    SECONDARY_COLOR = template.secondaryColor.toUpperCase()
    ACCENT_LIGHT = template.headerBg.toUpperCase()
    DARK_BG = template.coloredHeader ? template.accentColor.toUpperCase() : '1F2937'
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  }"""
c = c.replace(old_logic, new_logic)

f = open(r'src/lib/converters/powerpoint-converter.ts', 'w')
f.write(c)
f.close()
print('powerpoint-converter.ts updated')
