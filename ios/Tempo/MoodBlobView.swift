import SwiftUI

/// A calm SwiftUI take on `MoodBlob.tsx`: one soft body that droops a little when the mood
/// is low and lifts and rounds out when it's high, two eyes, and a mouth that bends from a
/// gentle frown to a smile. Everything is driven by the continuous 1–100 value, so the
/// blob reshapes as the slider moves; the colour steps with the five buckets.
struct MoodBlobView: View {
    /// 1–100.
    var value: Double
    var size: CGFloat = 120

    private var t: Double { (min(100, max(1, value)) - 1) / 99 }
    private var mood: Mood { Mood(value: Int(value.rounded())) }

    var body: some View {
        ZStack {
            MoodBlobShape(t: t)
                .fill(mood.body)

            face
        }
        .frame(width: size, height: size)
        .animation(.easeOut(duration: 0.3), value: mood)
        .accessibilityHidden(true)
    }

    private var face: some View {
        let s = size / 100
        // Low moods sit the face a touch lower, like the web's droopy blob.
        let faceY = (4 - t * 6) * s
        return ZStack {
            // Eyes: flatter when tired, rounder when bright.
            HStack(spacing: 22 * s) {
                eye(s)
                eye(s)
            }
            .offset(y: -6 * s)

            MouthShape(curve: t * 2 - 1)
                .stroke(mood.ink, style: StrokeStyle(lineWidth: max(1.5, 2.6 * s), lineCap: .round))
                .frame(width: (22 + t * 8) * s, height: 10 * s)
                .offset(y: 13 * s)
        }
        .offset(y: faceY)
    }

    private func eye(_ s: CGFloat) -> some View {
        Capsule()
            .fill(mood.ink)
            .frame(width: 8 * s, height: (5 + 4 * sin(t * .pi)) * s)
    }
}

/// The blob body: a circle in polar form with a slow three-lobed wobble, a downward sag at
/// low values and a slight vertical lift at high ones. Animatable, so changes glide.
struct MoodBlobShape: Shape {
    /// 0 (awful) … 1 (great).
    var t: Double

    var animatableData: Double {
        get { t }
        set { t = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let radius = min(rect.width, rect.height) * 0.42
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let wobble = 0.025 + 0.02 * abs(t - 0.5) * 2
        let sag = (1 - t) * 0.12
        let lift = t * 0.05
        let steps = 96

        var points: [CGPoint] = []
        points.reserveCapacity(steps)
        for i in 0..<steps {
            let theta = Double(i) / Double(steps) * 2 * .pi
            let r = radius * (1 + wobble * cos(3 * theta + 0.7 + t * 1.2))
            var x = cos(theta) * r
            var y = sin(theta) * r * (0.94 + lift)
            // Bottom half spreads and sinks a little when the mood is low.
            let bottom = max(0, sin(theta))
            x *= 1 + sag * 0.35 * bottom
            y += radius * sag * bottom * bottom
            // Top flattens slightly when low.
            let top = max(0, -sin(theta))
            y += radius * sag * 0.4 * top * top
            points.append(CGPoint(x: center.x + x, y: center.y + y - radius * sag * 0.25))
        }

        // Smooth closed curve through the samples (Catmull-Rom to cubic Béziers).
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for i in 0..<steps {
            let p0 = points[(i - 1 + steps) % steps]
            let p1 = points[i]
            let p2 = points[(i + 1) % steps]
            let p3 = points[(i + 2) % steps]
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            path.addCurve(to: p2, control1: c1, control2: c2)
        }
        path.closeSubpath()
        return path
    }
}

/// A single quadratic curve: −1 frowns, 0 is flat, 1 smiles.
struct MouthShape: Shape {
    var curve: Double

    var animatableData: Double {
        get { curve }
        set { curve = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        let bend = rect.height * curve
        path.move(to: CGPoint(x: rect.minX, y: midY - bend / 2))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: midY - bend / 2),
            control: CGPoint(x: rect.midX, y: midY + bend)
        )
        return path
    }
}

#Preview {
    HStack {
        ForEach(Mood.allCases, id: \.self) { mood in
            VStack {
                MoodBlobView(value: Double(mood.centerValue), size: 56)
                Text(mood.label).font(.caption)
            }
        }
    }
    .padding()
    .background(Theme.surface)
}
