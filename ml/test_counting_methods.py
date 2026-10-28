import unittest
import torch
from counting_point_model import heatmap_target,decode_points,center_focal_loss,CenterHeatmap
from counting_metrics import summarize

class CountingTests(unittest.TestCase):
    def test_two_separate_peaks_and_no_background_peaks(self):
        logits=torch.full((1,1,128,128),-20.)
        logits[0,0,20,20]=8;logits[0,0,20,24]=8
        self.assertEqual(len(decode_points(logits,.5)[0]),2)
        self.assertEqual(len(decode_points(torch.full_like(logits,-20),.5)[0]),0)
    def test_equal_counts_do_not_hide_wrong_locations(self):
        rows=[{'reference_points':[[.1,.1],[.2,.2]],'predicted_points':[[.8,.8,1],[.9,.9,1]]}]
        m=summarize(rows);self.assertEqual(m['MAE'],0);self.assertEqual(m['point_F1'],0)
    def test_one_reference_cannot_match_duplicate_predictions(self):
        m=summarize([{'reference_points':[[.2,.2]],'predicted_points':[[.2,.2,1],[.21,.2,1]]}])
        self.assertEqual(m['matched_points'],1);self.assertEqual(m['false_positive_points'],1)
    def test_targets_and_backward(self):
        y=heatmap_target([[.2,.3],[.8,.7]]);self.assertEqual(int((y==1).sum()),2)
        z=torch.zeros((1,1,128,128),requires_grad=True);loss=center_focal_loss(z,y[None]);loss.backward();self.assertTrue(torch.isfinite(z.grad).all())
    def test_architecture_output_resolution(self):
        torch.set_num_threads(1)
        model=CenterHeatmap().eval()
        with torch.no_grad():self.assertEqual(tuple(model(torch.zeros(1,3,128,128)).shape),(1,1,32,32))
if __name__=='__main__':unittest.main()
