// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TempoKit",
    platforms: [
        .iOS("26.0"),
        .macOS("26.0"),
    ],
    products: [
        .library(name: "TempoKit", targets: ["TempoKit"]),
    ],
    targets: [
        .target(
            name: "TempoKit",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "TempoKitTests",
            dependencies: ["TempoKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
