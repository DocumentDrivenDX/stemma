// Draws chosen pages of a PDF as PNG images, so that a quotation or a page
// number can be compared with the page itself. It uses PDFKit, which ships with
// macOS. Example preparation only; this is not part of Stemma.
//   swiftc -o render-pages render-pages.swift
//   ./render-pages <in.pdf> <existing out directory> <file index from 0>...
import AppKit
import PDFKit

let arguments = CommandLine.arguments
guard arguments.count > 3, let document = PDFDocument(url: URL(fileURLWithPath: arguments[1])) else {
    FileHandle.standardError.write("usage: render-pages <in.pdf> <out directory> <file index>...\n".data(using: .utf8)!)
    exit(2)
}
for argument in arguments.dropFirst(3) {
    let page = document.page(at: Int(argument)!)!
    let box = page.bounds(for: .mediaBox)
    let width: CGFloat = 900
    let image = page.thumbnail(of: NSSize(width: width, height: box.height * width / box.width), for: .mediaBox)
    let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
    let file = URL(fileURLWithPath: arguments[2]).appendingPathComponent("page-\(argument).png")
    try! bitmap.representation(using: .png, properties: [:])!.write(to: file)
}
