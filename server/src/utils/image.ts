export function extractImage(content: string) {
    const img_reg = /!\[.*?\]\((.*?)\)/;
    const img_match = img_reg.exec(content);
    let avatar: string | undefined = undefined;
    if (img_match) {
        avatar = img_match[1];
        console.log('Extracted avatar:', avatar);
    } else {
        console.log('No image found in content:', content.substring(0, 200));
    }
    return avatar;
}