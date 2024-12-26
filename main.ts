import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, Vault, MarkdownView, TextFileView } from 'obsidian';
import * as path from 'path';

interface Obsidian2MuSettings {
    outputDir: string;
    autoConvert: boolean;
}

const DEFAULT_SETTINGS: Obsidian2MuSettings = {
    outputDir: 'mu-output',
    autoConvert: false
}

// Add MuView class for rendering .mu files
class MuView extends TextFileView {
    constructor(leaf: any) {
        super(leaf);
    }

    getViewType() {
        return "mu-view";
    }

    getDisplayText() {
        return this.file?.basename || "Mu View";
    }

    async onOpen() {
        // Handle file open
    }

    async onClose() {
        // Handle file close
    }

    getViewData() {
        return this.data;
    }

    setViewData(data: string, clear: boolean) {
        this.data = data;
        // Convert mu to HTML for display
        const htmlContent = this.muToHtml(data);
        this.contentEl.innerHTML = `<div class="mu-content">${htmlContent}</div>`;
    }

    private muToHtml(muContent: string): string {
        return muContent
            // Headers
            .replace(/^>>>\s*(.*$)/gm, '<h3>$1</h3>')
            .replace(/^>>\s*(.*$)/gm, '<h2>$1</h2>')
            .replace(/^>\s*(.*$)/gm, '<h1>$1</h1>')
            
            // Bold
            .replace(/`!(.*?)`!/g, '<strong>$1</strong>')
            
            // Italic
            .replace(/`\*(.*?)`\*/g, '<em>$1</em>')
            
            // Links
            .replace(/`\[(.*?)`(.*?)\]/g, '<a href="$2">$1</a>')
            
            // Code blocks
            .replace(/`=\n([\s\S]*?)\n`=/g, '<pre><code>$1</code></pre>')
            .replace(/`=(.*?)`=/g, '<code>$1</code>')
            
            // Underline
            .replace(/`_(.*?)`_/g, '<u>$1</u>')
            
            // Lists
            .replace(/^-\s*(.*$)/gm, '<li>$1</li>')
            
            // Blockquotes
            .replace(/^>>>>(.*$)/gm, '<blockquote>$1</blockquote>')
            
            // Horizontal rules
            .replace(/^-$/gm, '<hr>')
            
            // Comments
            .replace(/^#\s*(.*$)/gm, '<!-- $1 -->');
    }

    clear() {
        this.data = "";
    }
}

export default class Obsidian2MuPlugin extends Plugin {
    settings: Obsidian2MuSettings;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async convertToMu() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !activeFile.extension.match(/md|markdown/)) {
            throw new Error('No markdown file is currently active');
        }
        await this.convertFile(activeFile);
    }

    async convertFile(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const converted = this.markdownToMu(content);
            
            const outputPath = path.join(this.settings.outputDir, `${file.basename}.mu`);
            
            // Ensure output directory exists
            await this.ensureFolder(this.settings.outputDir);
            
            // Check if file exists and modify it instead of recreating
            const existingFile = this.app.vault.getAbstractFileByPath(outputPath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, converted);
            } else {
                // Create new file only if it doesn't exist
                await this.app.vault.create(outputPath, converted);
            }

            // Update any open views
            const muFile = this.app.vault.getAbstractFileByPath(outputPath);
            if (muFile instanceof TFile) {
                this.app.workspace.getLeavesOfType('mu-view').forEach(leaf => {
                    if (leaf.view instanceof MuView && leaf.view.file === muFile) {
                        leaf.view.setViewData(converted, false);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to convert file:', error);
            throw new Error(`Failed to convert ${file.basename}: ${error.message}`);
        }
    }

    private markdownToMu(markdown: string): string {
        return markdown
            // Headers (exactly as specified)
            .replace (/^####\s+(.*$)/gm, '>>>> $1')
            .replace(/^###\s+(.*$)/gm, '>>> $1')
            .replace(/^##\s+(.*$)/gm, '>> $1')
            .replace(/^#\s+(.*$)/gm, '> $1')
            
            // Bold (using `!)
            .replace(/\*\*(.*?)\*\*/g, '`!$1`!')
            
            // Italic (using `*)
            .replace(/\*(.*?)\*/g, '`*$1`*')
            
            // Links (using `[text`url])
            .replace(/\[(.*?)\]\((.*?)\)/g, '`[$1`$2]')
            
            // Code blocks (using `= for both inline and blocks)
            .replace(/```(.*?)\n([\s\S]*?)```/g, '`=\n$2\n`=')
            .replace(/`([^`]+)`/g, '`=$1`=')
            
            // Underline (using `_)
            .replace(/__(.*?)__/g, '`_$1`_')
            
            // Lists (simple -)
            .replace(/^\s*[-*+]\s/gm, '- ')
            
            // Blockquotes (using >>>>)
            .replace(/^>\s*(.*$)/gm, '>>>>$1')
            
            // Horizontal rules (simple -)
            .replace(/^[-*_]{3,}\s*$/gm, '-')
            
            // Comments (using #)
            .replace(/^#\s*(.*$)/gm, '# $1')
            
            // Add newlines after sections
            .replace(/^(>+.*$)/gm, '$1\n')
            
            // Ensure proper spacing
            .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines to double
            .trim();
    }

    private async ensureFolder(folderPath: string) {
        const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
        if (!abstractFile) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    async onload() {
        console.log('Loading Obsidian2Mu Plugin');
        try {
            await this.loadSettings();
            
            // Register .mu extension and viewer
            this.registerExtensions(['mu'], 'mu-view');
            this.registerView('mu-view', (leaf) => new MuView(leaf));
            
            this.addSettingTab(new Obsidian2MuSettingTab(this.app, this));

            this.addRibbonIcon('file-down', 'Convert to .mu', async () => {
                try {
                    await this.convertToMu();
                    new Notice('Conversion completed successfully');
                } catch (error) {
                    console.error('Conversion failed:', error);
                    new Notice(`Conversion failed: ${error.message}`);
                }
            });

            // Enhanced auto-convert with debouncing
            if (this.settings.autoConvert) {
                let timeoutId: NodeJS.Timeout;
                
                this.registerEvent(
                    this.app.vault.on('modify', async (file: TFile) => {
                        if (file.extension === 'md' || file.extension === 'markdown') {
                            // Clear previous timeout
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            // Set new timeout to prevent multiple rapid conversions
                            timeoutId = setTimeout(async () => {
                                try {
                                    await this.convertFile(file);
                                    
                                    // Try to find and refresh the corresponding .mu file view
                                    const muPath = `${this.settings.outputDir}/${file.basename}.mu`;
                                    const muFile = this.app.vault.getAbstractFileByPath(muPath);
                                    
                                    if (muFile instanceof TFile) {
                                        // Get the file content once
                                        const muContent = await this.app.vault.read(muFile);
                                        
                                        // Refresh all instances of this file's view
                                        for (const leaf of this.app.workspace.getLeavesOfType('mu-view')) {
                                            if (leaf.view instanceof MuView && leaf.view.file === muFile) {
                                                leaf.view.setViewData(muContent, false);
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.error('Auto-conversion failed:', error);
                                    new Notice(`Auto-conversion failed: ${error.message}`);
                                }
                            }, 500); // 500ms debounce delay
                        }
                    })
                );
            }
        } catch (error) {
            console.error('Failed to load plugin:', error);
        }
    }

    async onunload() {
        console.log('Unloading Obsidian2Mu Plugin');
    }
}

class Obsidian2MuSettingTab extends PluginSettingTab {
    plugin: Obsidian2MuPlugin;

    constructor(app: App, plugin: Obsidian2MuPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Output Directory')
            .setDesc('Directory where .mu files will be saved')
            .addText(text => text
                .setPlaceholder('mu-output')
                .setValue(this.plugin.settings.outputDir)
                .onChange(async (value) => {
                    this.plugin.settings.outputDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Convert')
            .setDesc('Automatically convert files when they are modified')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoConvert)
                .onChange(async (value) => {
                    this.plugin.settings.autoConvert = value;
                    await this.plugin.saveSettings();
                }));
    }
} 