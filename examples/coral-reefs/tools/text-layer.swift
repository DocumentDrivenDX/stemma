// Writes the text layer already inside a PDF, one page at a time, with a form
// feed after each page: the shape `source text --text-layer` takes. It uses
// PDFKit, which ships with macOS. It recognizes nothing in the page images.
// Example preparation only; this is not part of Stemma.
//   swiftc -o text-layer text-layer.swift && ./text-layer <in.pdf> <out.txt>
import Foundation
import PDFKit

let arguments = CommandLine.arguments
guard arguments.count == 3, let document = PDFDocument(url: URL(fileURLWithPath: arguments[1])) else {
    FileHandle.standardError.write("usage: text-layer <in.pdf> <out.txt>\n".data(using: .utf8)!)
    exit(2)
}
var text = ""
for index in 0..<document.pageCount {
    text += (document.page(at: index)?.string ?? "").replacingOccurrences(of: "\u{0c}", with: " ")
    text += "\u{0c}"
}
try! text.write(toFile: arguments[2], atomically: true, encoding: .utf8)
print("\(document.pageCount) pages")
