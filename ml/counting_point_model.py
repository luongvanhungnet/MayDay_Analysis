"""Small stride-4 center-heatmap detector; not a P2PNet implementation."""
import torch
from torch import nn
from torch.nn import functional as F
from torchvision.models import resnet18, ResNet18_Weights

class CenterHeatmap(nn.Module):
    def __init__(self, pretrained=False):
        super().__init__()
        backbone=resnet18(weights=ResNet18_Weights.DEFAULT if pretrained else None)
        self.stem=nn.Sequential(backbone.conv1,backbone.bn1,backbone.relu,backbone.maxpool)
        self.stages=nn.ModuleList([backbone.layer1,backbone.layer2,backbone.layer3,backbone.layer4])
        self.laterals=nn.ModuleList([nn.Conv2d(c,64,1) for c in [64,128,256,512]])
        self.head=nn.Sequential(nn.Conv2d(64,64,3,padding=1),nn.ReLU(),nn.Conv2d(64,1,1))
        nn.init.constant_(self.head[-1].bias,-2.19)
    def forward(self,x):
        x=self.stem(x);features=[]
        for stage,lateral in zip(self.stages,self.laterals):
            x=stage(x);features.append(lateral(x))
        out=features[-1]
        for feature in reversed(features[:-1]):out=F.interpolate(out,size=feature.shape[-2:],mode='bilinear',align_corners=False)+feature
        return self.head(out)

def heatmap_target(points,size=128,sigma=1.5):
    y,x=torch.meshgrid(torch.arange(size),torch.arange(size),indexing='ij');out=torch.zeros(size,size)
    for px,py in points:
        xx=min(size-1,max(0,int(px*size)));yy=min(size-1,max(0,int(py*size)))
        out=torch.maximum(out,torch.exp(-((x-xx)**2+(y-yy)**2)/(2*sigma*sigma)))
    return out.unsqueeze(0)

def center_focal_loss(logits,target):
    p=logits.float().sigmoid().clamp(1e-5,1-1e-5);positive=target.eq(1);negative=target.lt(1)
    loss=-(p.log()*(1-p).pow(2)*positive+(1-p).log()*p.pow(2)*(1-target).pow(4)*negative)
    return loss.sum()/positive.sum().clamp(min=1)

def decode_points(logits,threshold):
    p=logits.float().sigmoid();keep=(p==F.max_pool2d(p,3,stride=1,padding=1))&(p>=threshold)
    output=[]
    for b in range(len(p)):
        yy,xx=torch.where(keep[b,0]);scores=p[b,0,yy,xx];order=torch.argsort(scores,descending=True)[:1000]
        output.append([[float((xx[i]+.5)/p.shape[-1]),float((yy[i]+.5)/p.shape[-2]),float(scores[i])] for i in order])
    return output
