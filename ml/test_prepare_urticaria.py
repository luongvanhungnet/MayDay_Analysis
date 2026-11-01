import unittest
from prepare_urticaria import detection_row


class AnnotationTests(unittest.TestCase):
    def test_polygon_is_enclosed_by_derived_box(self):
        row, kind, cls = detection_row("2 0.1 0.2 0.5 0.2 0.5 0.8 0.1 0.8")
        self.assertEqual(kind, "polygon")
        self.assertEqual(cls, 2)
        self.assertEqual(list(map(float, row.split()[1:])), [0.3, 0.5, 0.4, 0.6])

    def test_box_stays_a_box(self):
        row, kind, _ = detection_row("1 0.5 0.4 0.2 0.1")
        self.assertEqual(kind, "box")
        self.assertEqual(list(map(float, row.split()[1:])), [0.5, 0.4, 0.2, 0.1])

    def test_invalid_annotations_are_not_silently_discarded(self):
        for line in ("2 nan 0.5 0.1 0.1", "3 0.5 0.5 0.1 0.1", "2 0.1 0.2 0.3", "2 0.5 0.5 0 0.1"):
            with self.subTest(line=line), self.assertRaises(ValueError):
                detection_row(line)


if __name__ == "__main__":
    unittest.main()
